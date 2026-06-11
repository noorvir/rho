# Current Work: Make Rho Useful — Self-knowledge, Chat UX, Durable Background Work

## Goals

Rho exists so a non-technical user can build and modify their own apps by
talking to it. Three things block that today:

1. **Self-knowledge**: the agent must deeply understand how Rho itself works
   (database + schema changes, extensions, server management, channels and
   what users see) without burning turns reading files one by one.
2. **Chat UX**: in channels, Rho must behave like a person — no technical
   jargon unless asked, and for long work it must say "on it, this will take a
   few minutes, I'll message you when done" instead of holding a stream open.
3. **Durability**: backgrounded work must survive provider/network errors and
   server restarts. It either recovers or tells the user. It never silently
   dies. This is a hard requirement.

Work in quick, individually testable iterations.

## Non-goals

- Multi-user support, heavy infra (Redis, Temporal, queues-as-a-service).
- Vector memory / semantic search (FTS + files is enough; see memory plan).
- Push notifications in the first iterations (client refetch covers it; push
  is a later iteration).
- Porting WhatsApp/Telegram channels in this pass.

## Research Lessons (OpenClaw, Hermes, production agents)

Full reports: `openclaw-research.md`, `hermes-research.md`,
`long-running-agents-research.md` (repo root).

- **Ack-immediately + announce-later without a durable task store makes
  restarts a data-loss event.** OpenClaw bolted on sweepers/tombstones after
  the fact; design the durable task record first.
- **One append-only event/checkpoint log per task** doubles as resume
  checkpoint, progress feed, and audit trail. Pi session files already are
  this — reuse them rather than inventing a parallel log.
- **Three notification-worthy terminal states**: done, failed, *needs input*.
  Naive designs forget the third. Failure is a completion and must notify.
- **The always-on server owns delivery.** Late messages route through the
  process that owns channel connections; the original request context is
  irrelevant. A `notified` flag per terminal transition prevents duplicates.
- **Progressive disclosure is the proven prompt shape**: tiny always-loaded
  layer with hard budgets, a skills index (name + description only), full
  docs read on demand. Keep volatile facts out of the stable prompt prefix
  (provider cache stability).
- **Retry discipline**: classify errors (transient → backoff with jitter and
  caps; permanent → fail fast), bounded attempts, then terminal failed +
  notify. Idempotency keys for side-effectful tool calls can come later.

## Current Direction

Three workstreams, shipped as small iterations:

### A. Self-knowledge + progressive disclosure

Three context layers:

- **Layer 0 — system prompt (always loaded, small)**: rewrite the Rho prompt
  around identity, the non-technical-user rule (no technical detail unless
  asked), channel awareness (what the user can see), long-task etiquette
  (estimate, ack, background, notify), and a ~15-line capability map of what
  Rho is and can do.
- **Layer 1 — core bundle (one shot on demand)**: a built-in `rho_context()`
  tool (no parameters) available in every Rho agent session. It reads a
  hardcoded list of core doc pages, verifies the combined result fits a hard
  size budget, and returns it as one normal tool result. Docs stay the
  single source of truth; the tool owns only the path list and the budget.
  The prompt instructs: when the user asks to modify Rho, call
  `rho_context()` first — unless its output is already in context. A test
  asserts the bundle stays under budget so doc growth is caught at build
  time; at runtime the tool never throws or truncates — oversized context is
  handled by normal session compaction.
- **Layer 2 — detail (lazy)**: everything else is the normal `read` tool.
  Restructure `docs/` so core pages are small and bundle-worthy, and
  reference detail lives in separate pages the agent reads individually only
  when needed. The tool never mediates those reads.

### B. Long-task chat UX + durable background tasks

- **Task record in rho.sqlite** with an explicit state machine, heartbeat
  timestamp, bounded retry count, error, result summary, and a notified flag:

  ```txt
  queued -> running -> done | failed
  running -> queued     (transient error or boot recovery; attempt++)
  ```

  `waiting_input` and `cancelled` states arrive with their flows (later);
  unsupported states stay unrepresentable until then. Every transition into
  a terminal state appends an outcome
  message to the originating conversation and delivers it through the owning
  channel; the notified flag dedupes.
- **Agent-initiated backgrounding** via an extension-contributed tool: the
  agent decides work is long, calls the tool with a task description, then
  replies with a short conversational ack. The HTTP stream closes normally.
- **Execution**: the background run is its own pi session keyed to the task,
  running in the server process. Pi session files are the checkpoint log.
  Provider/network errors retry with backoff and caps; exhausted retries mark
  the task failed.
- **Completion/failure/needs-input delivery**: append the outcome as an
  assistant message in the originating conversation (durable, always first)
  and deliver through the owning channel. Runtime gains an outbound deliver
  path (channel + target) usable outside any request.
- **HTTP channel delivery — no websockets, no event bus**: the ack stream
  ends with a structured task-started event carrying the task id. While the
  app is open, the client polls task status every few seconds until terminal,
  then refetches messages; it also refetches on app foreground regardless.
  When the app is closed, nothing can reach it except OS push — websockets
  die in background too — so closed-app notification is APNs in iteration 4,
  not socket infrastructure now.
- **Boot recovery**: on server start, scan running tasks with stale
  heartbeats; resume from the session checkpoint or mark interrupted and tell
  the user. No silent loss.

### C. Channel friendliness

Mostly prompt work (Layer 0) plus the ack/notify mechanics from B. The agent
must not expose stack traces, file paths, or internals in channel replies
unless the user asks; errors become plain-language messages with a next step.

## Implementation Details

### rho_context tool
- Agent extension factory in the ai package, registered into server agent
  sessions (TUI can follow later). Options: docs directory + hardcoded core
  page list. Returns the concatenated core pages as one tool result.
- A test asserts the bundle stays under its token budget.

### Core docs
- New core pages for channels (including what users can and cannot see) and
  server management. Database and extensions pages stay the core entry
  points; schema/app/sdk references remain detail pages behind normal reads.

### Task model (rho.sqlite, core Prisma schema)

```txt
Task { id, conversationKey, channelId, targetType, targetId,
       instructions, status, attempt, error?, summary?,
       sessionFile?, heartbeatAt?, notifiedAt?, createdAt, updatedAt }
status: queued | running | done | failed
```

### background_task tool
- Registered per conversation turn with the conversation key/channel/target
  in closure. Inserts the task row and returns the task id; the agent then
  finishes its turn with a conversational ack.

### Task runner
- In-process loop in the server runtime: claims queued tasks, runs each in
  its own pi session (session file stored on the task row = checkpoint),
  heartbeats while running, transitions on completion/error.
- Outcome: append a message to the originating conversation session (visible
  in history and next-turn context), mark notified.

### HTTP surface
- Tasks endpoint: list/status tasks for a conversation so clients can poll
  while a task is active. No stream contract change needed.

### Clients (web + mobile)
- After each completed send: fetch active tasks; while any are active, poll
  status every few seconds; on terminal status refetch messages; always
  refetch on app foreground/focus.

### Later (noted, not in this pass)
- Mid-task status questions: the conversation agent reads the task row and
  reports progress when the user asks "how's it going".
- Shared progress state: the task agent maintains a progress checklist that
  the conversation agent can read and an app widget could render as a
  progress bar.
- Optional transparency widget in chat: a collapsed list of tool activity
  (or a dev mode) for users who want to peek under the hood.
- APNs push; waiting_input follow-ups routed back into the task session.

### Direction: shared runtime package for the database (next)
Extensions and the agent must be able to evolve the schema, but `@rho/core`
is an installed, non-modifiable package. The schema, migrations, and
generated client should move to a runtime-owned package that lives with the
modifiable extension layer. One SQLite database only: system tables (tasks,
auth, …) share it with extension tables, distinguished by a `_sys_`-style
prefix rather than separate files.

## Iterations

1. **Prompt + self-knowledge**: rewrite system prompt (Layer 0), add
   `rho-internals` skill (Layer 1), restructure docs (Layer 2). Testable
   immediately in TUI and web/mobile chat.
2. **Task model + ack UX**: task table, background tool, detached execution,
   completion appended to conversation, client refetch on focus.
3. **Durability hardening**: retries with backoff, heartbeats, boot recovery,
   failure/needs-input messages. Kill-the-server-mid-task test passes.
4. **Proactive delivery + memory**: push (APNs or ntfy), then fold in the
   background memory consolidator from
   `.agent/plans/2026-06-10-background-agent-memory.md` as a scheduled task on
   the same runner.

## Success Criteria

- [ ] Asking Rho "add a field to my todo app" loads core self-knowledge in
      one read and proceeds without exploratory file-by-file reads.
- [ ] Channel replies contain no unrequested technical detail.
- [ ] A long task gets a conversational ack, the connection closes, and the
      result arrives later as a new message in the conversation.
- [ ] Killing the server mid-task: on restart the task resumes or the user is
      told. Provider errors retry; exhausted retries notify the user.
- [ ] No background failure mode ends in silence.

## Tests / Validation

Primary acceptance scenario, verified on web (frontend-dev skill) and iOS
(mobile-dev skill):

1. In chat: "Build me a todo list app."
2. Agent acks conversationally (no technical detail), says it will work in
   the background and report back; the request stream closes.
3. The background task builds the extension, applies the schema change
   through Rho-managed migration, and reloads the runtime.
4. The new app appears in the web and mobile app lists.
5. A completion message arrives in the conversation (poll while active,
   refetch on foreground).

Layered build-from-scratch scenarios (progressively harder schema reuse):

1. **Contacts app on an existing table**: "build me a contacts app" — must
   reuse the existing `contacts` table, not create a parallel one.
2. **Events app with invites**: "build an events app to track upcoming
   events, with invites" — must create a new events schema while referencing
   the existing contacts table for invitees.

Also:

- Budget test: rho_context output stays under its token budget.
- Task lifecycle: background a slow task, close the client, fetch history
  later and see the outcome message.
- Durability (iteration 3): forced provider error retries with backoff; kill
  the server mid-task → restart resumes or notifies.
- Prompt behavior: "modify rho" asks trigger exactly one rho_context call;
  channel replies stay non-technical.

## Progress

- [x] Research: OpenClaw, Hermes, production long-task patterns (reports in
      `.agent/research/`).
- [x] Iteration 1: system prompt rewrite, rho_context tool, docs
      restructure (channels + server core pages, rho.db extension data).
- [x] Iteration 2: task model + backgrounding + completion delivery; web and
      mobile poll active tasks and refetch on terminal/foreground.
- [x] Iteration 3 (core): bounded retries with backoff, heartbeats, boot
      recovery requeue, unnotified-outcome redelivery. Verified incidentally:
      a dev-server restart mid-task recovered and completed on attempt 2.
- [x] E2E (web): "Build me a todo list app" → conversational ack → background
      task → Todo model migrated → runtime reloaded → app live and CRUD
      working → outcome message delivered to the conversation.
- [x] Mobile: live app list from apps.json, authenticated app WebView via
      bearer→cookie web-session exchange, task polling + foreground refetch.
- [x] Embedded app surface: `/embed/apps/<slug>` renders only the app (no
      dashboard shell), reports platform `mobile`, and embedded contexts use
      the embed base path so in-app navigation stays inside it. The mobile
      WebView is locked to same host + `/embed/` main-frame navigation.
- [x] Native-feel WebView: 16px input floor kills iOS focus auto-zoom,
      viewport/pinch/double-tap locked, tap-highlight and link previews off,
      keyboard accessory bar removed, drag-to-dismiss keyboard.
- [x] Server hardening: crash guards (uncaught exception/rejection log and
      continue — a TUI-oriented pi extension crashed the server once).
- [x] Second e2e (workout tracker built out by chat): agent reused its
      session checkpoint after watch-restart interruptions, added the
      planned_exercises model/migration, and delivered a clean outcome.
- [x] Elegance review pass: TaskStatus narrowed to implemented states,
      KeyedMutex releases its per-key tail.
- [ ] Railway deploy of the above; verify on a physical phone with a release
      build against production.
- [ ] Iteration 3 (remaining): forced provider-error test; waiting_input.
- [ ] Iteration 4: push delivery + memory consolidator on the task runner.

Notes:
- Outcome/ack tone still drifts technical; prompts tightened once, needs
  another iteration with transcript checks.
- Embedded mobile WebView renders the full dashboard shell; an app-only
  embedded layout is deferred UI work.
- Vite dev-mode wedged once on a newly discovered dependency of the built
  extension (optimizer stall); a dev-server restart cleared it.
- Agent-runtime testing must run the server WITHOUT `bun --watch`: watch
  restarts on the agent's own edits kill in-flight tasks (one task burned all
  three attempts this way) and reload extensions mid-edit. Watch mode is for
  developing rho itself; the runtime applies changes only via explicit
  reload. The deployed runtime is unaffected (no watch).
