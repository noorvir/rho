# Current Work: Installed runtime home (immutable core, runtime-owned db + extensions)

## Goals

Rho must work as an installed product: server + CLI installed via npm, always
running, agent writes/changes extensions and schema at runtime. Installed
packages are immutable; everything mutable lives in one runtime home
directory that core receives as configuration:

```
<rho home>/
  db/            schema.prisma, migrations/, generated/, rho.sqlite
  extensions/    one workspace package; all extensions share deps and schema
  pi/            agent dir (exists today)
  state/         sessions etc. (exists today)
```

- `rho init` seeds the home dir: schema with system tables, initial
  migration, generated client, extensions workspace skeleton.
- The agent owns `db/schema.prisma` after init; schema changes follow the
  existing copy-validate-apply procedure and `rho_reload` hot-swap, importing
  the regenerated client from `db/generated/`.
- Same layout in all environments: installed (npm), Railway (home dir on the
  volume — fixes the redeploy wipe of agent-built extensions and
  schema/migrations), and dev (gitignored local home dir).

## Non-goals

- Multi-user/multi-tenant runtimes.
- Extension marketplace/distribution; this is about the local runtime layout.
- Migrating existing committed example extensions out of the repo; they stay
  as curated examples. Agent-built apps stop being committed.

## Current Direction

- Core stays typed against system models (tasks, auth) via a vendored client
  generated from the seed schema at publish time — types only. The runtime
  client instance is constructed from `db/generated/` (the superset schema);
  the existing reloadable-prisma proxy/swap machinery gains a configured
  generated-client dir instead of repo-relative path guessing.
- Core-owned tables are enforced, not assumed: the `_rho_*` system models are
  a checked invariant. Reload refuses any regenerated client missing them, so
  extensions and agents cannot remove core tables. Seeded shared models
  (contacts, orgs) stay agent-evolvable.
- Extensions get typed access to their own models by importing from the
  shared `db/generated/` next to them.
- Extension loading (jiti), app bundling (Bun.build), and per-app CSS already
  work from arbitrary directories at runtime; they point at the home dir.
- Server boot applies pending migrations (`migrate deploy`); `db push` only
  for first-boot convenience if init hasn't run.

## Success Criteria

- [ ] A clean machine: npm-installed rho, `rho init`, server starts, agent
      builds a model-bearing app end to end — no repo checkout involved.
- [ ] Core package contains no runtime-mutated paths (schema, migrations,
      generated client, extensions all under the home dir).
- [ ] Railway: home dir on the volume; agent-built apps and schema survive a
      redeploy.
- [ ] Dev mode uses the same layout (gitignored home dir), same code paths.
- [ ] Hot-swap reload works in the installed layout (generated dir is
      configured, not inferred from core's source location).

## Tests / Validation

- Hot-swap battle test re-run against a configured generated dir.
- Fresh-install simulation: temp home dir + init + boot + agent E2E app
  build with a new model.
- Railway: deploy, build an app by chat, redeploy, app still present.

## Progress

- [x] Direction agreed with user: immutable core, runtime home dir, single
      shared schema seeded with system tables, stop committing agent-built
      extensions.
- [x] Decisions: single `RHO_HOME` env var (existing vars become overrides);
      seed = system tables + contacts/orgs (evolvable); single `rho` npm
      package; `_rho_*` models enforced as non-removable at reload.
- [x] Core: `generatedClientDir` option threaded to the reloadable client;
      `assertSystemModels` tripwire before every swap. Tested: rogue client
      generated from a runtime-style `db/` dir without system tables is
      refused, live client unaffected.
- [x] System models renamed to `rho_sys_*` (models and tables) via a
      data-preserving hand-written migration; docs + prompt mark them
      read-only.
- [x] CLI: `rho init` — seeds db from core's `db-template/` (system tables +
      contacts/orgs), runs migrate deploy + generate, creates the extensions
      workspace (hoisted linker; file:-linked @rho packages with overrides).
      Idempotent; Docker CMD runs it on every boot.
- [x] Server: `RHO_HOME` env with per-var overrides; extensionsDir +
      generatedClientDir wired through core options.
- [x] Railway: `RHO_HOME=/data/rho`; RHO_DATABASE_URL/RHO_STATE_DIR/
      RHO_EXTENSION_PATHS removed. Fresh home db seeded on volume; owner
      setup re-run (password "password" — user should change it).
- [x] Redeploy survival proven: prod agent built bookmarks app; source moved
      to /data/rho/extensions (agent initially placed it in the image's
      examples dir — prompt guidance added, examples path removed from prod);
      schema + migration landed in /data/rho/db correctly; after full
      redeploy the app loads from the volume.
- [x] Clean slate: migration history scrubbed to a single init; core schema
      is system-only (+ seeded contacts/orgs) and doubles as the home
      template (`rho init` rewrites the generator output path on copy;
      db-template/ removed). `TaskStatus` → `rho_sys_TaskStatus`. Dev runs on
      a gitignored `.rho-dev` home with example app models as runtime
      migrations; prod home reset and re-seeded (owner setup pending, user
      sets password). Boot now swaps in the home generated client, so
      runtime-added models work immediately after restart, not just after
      rho_reload.
- [x] Extension model typing: `RhoRuntimeModels` augmentation hook in
      @rho/core + `RhoModelDelegate<Row>` in apps-sdk; examples declare
      their models in `src/models.d.ts` and typecheck against the
      system-only core client.
- [x] Verified: prod agent build (todo-list, user-initiated) landed in
      $RHO_HOME/extensions unaided, schema + migration in $RHO_HOME/db,
      copy-validation followed, 6:00 total, single attempt.
- [ ] Build-speed work (target 30–60s): 96% of the 6:00 was model latency
      across 57 turns (tool execution: 15s). Levers: app-build recipe +
      inline example in rho_context, one-shot scaffold command, rho_migrate
      tool collapsing the validation procedure, lower thinking level or
      faster model for task sessions.
- [ ] Document the models.d.ts augmentation pattern in docs (template +
      extension-schema docs) so agents pick it up.
- [x] Orchestrator/implementer separation: channel sessions are read-only
      (excludeTools: bash/edit/write/rho_migrate/rho_reload; pi gotcha: the
      `tools` allowlist also removes extension tools — use the denylist),
      rho_query gives realtime read-only SQL for data questions,
      background_task description is delegation-first. Task sessions get
      their own model/thinking via RHO_TASK_MODEL/RHO_TASK_THINKING_LEVEL.
      Validated: gpt-5.5 and gpt-5.4-mini at low thinking both delegate
      builds (capability removal forces it) and the implementer override
      builds correctly regardless of the chat model.
- [ ] Task instruction ceremony trim (36-turn task path vs 9-turn inline);
      ensure final rho_reload is the last task step (one build needed a
      manual reload after completion).
- [ ] Dev mode on the same layout (repo currently keeps RHO_DATABASE_URL +
      RHO_EXTENSION_PATHS overrides).
- [ ] npm packaging slice: publish single `rho` package; installed-layout
      smoke test without a repo checkout.
