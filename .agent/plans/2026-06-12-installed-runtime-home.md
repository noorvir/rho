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
- [ ] Decide: single `RHO_HOME` env var with conventional subdirs (existing
      vars become overrides).
- [ ] Core: configured db dir (schema/migrations/generated/sqlite paths),
      reloadable prisma imports from it; vendored system-model types.
- [ ] CLI: `rho init` seeding (system tables incl. personal-data primitives),
      extensions workspace skeleton.
- [ ] Server boot: migrate deploy; extensions dir from home.
- [ ] Docker/Railway: home dir on volume.
- [ ] Dev mode on the same layout.
- [ ] End-to-end validation (fresh install + Railway redeploy survival).
