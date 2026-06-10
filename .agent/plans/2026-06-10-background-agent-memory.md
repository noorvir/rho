# Current Work: Background Agent and Shared Memory (name TBD)

## Goals

Give Rho durable, cross-surface memory and a background agent that maintains
it. The TUI, server agent, and channels should share one memory workspace so
every surface remembers the same things.

Working name only; the feature will be renamed before it is user-facing.

## Direction

Sessions stay ephemeral. Continuity comes from durable files plus derived
search, not from one infinite session. This matches what OpenClaw and Hermes
both converged on; neither runs a literally continuous session.

- Markdown files are the source of truth for memory. No hidden state.
- A small curated layer is always injected at session start and stays bounded
  (Hermes-style char/token budget that forces consolidation).
- Unbounded working notes (e.g. dated note files) live on disk, searchable but
  not injected.
- Search indexes (SQLite FTS over sessions and notes) are derived and
  rebuildable; losing the index loses nothing.
- The background agent is a consolidator, not a chat: it runs on a
  heartbeat/schedule, distills working notes into the curated layer, and
  writes reviewable artifacts instead of mutating memory silently.

## Proposed Shape

```txt
<workspace>/
  MEMORY.md            # curated, bounded, injected at session start
  USER.md              # user profile, bounded, injected (maybe merged later)
  notes/YYYY-MM-DD.md  # working notes, searchable, not injected
  <review artifact>    # background-agent promotions for human review
```

- Memory tools (read/search/append/consolidate) ship as agent extensions so
  the repacked TUI and the server runtime get identical behavior
  (depends on `.agent/plans/2026-06-09-agent-extension-model.md`).
- The workspace lives under the Rho runtime/agent dir so all surfaces share it.
- Background runs produce artifacts the user can review; promotion into the
  curated layer should be conservative (scored/gated, OpenClaw "dreaming"
  style) rather than automatic.

## Non-goals

- A literally continuous/infinite session.
- Vector databases or external memory services in the first version; FTS over
  markdown and session files is enough to start.
- Automatic memory writes without a review surface.

## Open questions

- Final name for the background agent.
- Whether the background agent runs inside the rho server daemon or as a
  scheduled standalone process.
- Whether USER.md is separate or a section of MEMORY.md.

## Success Criteria

- [ ] One memory workspace shared by TUI, server agent, and channels.
- [ ] Curated layer injected at session start with a hard size budget.
- [ ] Working notes searchable from any surface via a memory tool.
- [ ] Background consolidation produces reviewable artifacts; curated layer
      changes are traceable.
- [ ] Memory state survives index deletion (files are truth).

## Tests / Validation

- Write/read/search round-trip from both the TUI and the server runtime.
- Kill the index, rebuild, verify identical search behavior.
- Verify the curated layer never exceeds its budget.
