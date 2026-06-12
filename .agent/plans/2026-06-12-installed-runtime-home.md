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
- [ ] Re-verify: next prod agent app build lands in $RHO_HOME/extensions
      unaided (guidance is new and untested).
- [ ] Dev mode on the same layout (repo currently keeps RHO_DATABASE_URL +
      RHO_EXTENSION_PATHS overrides).
- [ ] npm packaging slice: publish single `rho` package; installed-layout
      smoke test without a repo checkout.
