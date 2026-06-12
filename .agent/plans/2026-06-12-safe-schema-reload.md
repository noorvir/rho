# Current Work: Safe schema changes without server restarts

## Goals

Agent-built apps frequently add database models. Today the only way a running
server picks up a regenerated Prisma client is a process restart — so the
agent kills the server it lives in, killing its own task session and any
other background work. This must become a first-class runtime operation:

1. The running server hot-swaps its database client on `rho_reload` — no
   restarts, ever.
2. The agent follows a safe migration procedure: snapshot the live SQLite
   file, apply the migration to the copy first, optionally boot a disposable
   test server against the copy, and only then apply to the live database and
   reload.

## Non-goals

- The runtime-db package split (moving schema/migrations/generated client out
  of `@rho/core`). That direction stands; this work is compatible with it.
- Schema-change UX for non-technical users (approval flows) beyond what
  docs/database.md already describes.

## Current Direction

- `createReloadableRhoPrisma` in core: a stable Proxy client every consumer
  (loader, task runner, extension contexts) can capture forever, plus a
  `reload()` that cache-bust-imports the regenerated client (preferring
  `src/generated`, which `prisma generate` writes directly), constructs the
  new client, swaps, disconnects the old. Failure leaves the old client
  untouched.
- `core.reload()` swaps the db client before reloading extensions, so
  `rho_reload` is the single "apply my changes" tool.
- Hard rule in the system prompt and `rho_reload` description: never kill or
  restart the rho server. The copy-validate-apply procedure lives in
  docs/database.md (which rho_context feeds the agent).

## Success Criteria

- [ ] An agent task that adds a new model completes without any server
      restart: migration validated on a copy, applied live, `rho_reload`
      called, new model queryable immediately.
- [ ] In-flight sessions and tasks survive schema changes.
- [ ] Docs describe the procedure; system prompt carries the no-restart rule.

## Tests / Validation

- Typecheck + build + existing tests.
- E2E: ask the agent to build a new model-bearing app and verify zero
  restarts (server PID stable throughout) and a working app.

## Progress

- [x] Hot-swap implementation (`prisma.ts`, `core.ts`), `rho_reload`
      description, docs/database.md procedure, system prompt rule.
- [ ] E2E validation with a fresh agent-built app.
- [ ] Later: runtime-db package split; supervised restart path for installed
      runtimes where the generated client ships compiled only.
