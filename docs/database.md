# Database

Rho uses one shared SQLite database for the user's runtime.

The shared database lets installed apps and extensions work with the same user data instead of creating separate app silos by default.

## Runtime database

A Rho runtime stores database files under its database directory:

```txt
db/
  schema.prisma
  rho.sqlite
  generated/
```

| Path | Purpose |
|------|---------|
| `db/schema.prisma` | Canonical Prisma schema for the runtime. |
| `db/rho.sqlite` | Shared SQLite database. |
| `db/generated/` | Generated database client for the canonical schema. |

## Runtime layouts

In an installed runtime the paths above live under the runtime's `db/`
directory. When Rho runs from its source repository (development), the same
roles map to:

| Role | Source-repo path |
|------|------------------|
| Canonical schema | `packages/core/prisma/schema.prisma` |
| Shared database | the file behind `RHO_DATABASE_URL` (dev default `packages/core/dev.db`) |
| Generated client | `packages/core/src/generated/prisma/` |

Apply schema changes with the runtime procedure below — it works the same
against a dev or installed runtime database.

## Ownership

Rho owns `db/schema.prisma`. That file is the only schema file for the installed runtime.

The `_rho_*` tables (tasks, owner, sessions, API tokens) are rho system
tables: core depends on them, and they must never be removed or renamed.
`rho_reload` refuses to swap in a database client that lost any of them.
Seeded shared models such as contacts and orgs are different: extensions may
evolve them with non-destructive migrations.

An extension may also have its own schema file inside its package. That package schema is for standalone mode: running the extension by itself for development, tests, demos, or previews before it is installed into a user's Rho runtime.

Installed extensions do not edit `db/schema.prisma` themselves. When an installed extension needs database changes, Rho performs the change as a host operation.

## Schema changes

Rho changes the installed database in this order:

1. Read the current runtime schema from `db/schema.prisma`.
2. Read the extension's schema requirements.
3. Compare the extension requirements with the runtime schema.
4. Choose one of these actions for each requirement:
   - reuse an existing compatible model or field
   - add a missing model or field
   - adapt a compatible existing shape with a non-destructive change
   - stop and ask the user when the change affects existing data
5. Write the approved result back to `db/schema.prisma`.
6. Create and run a Prisma migration from the updated schema against `db/rho.sqlite`.
7. Regenerate `db/generated/` from the updated runtime schema.

Rho must not let extension code run its own install-time schema mutation against the shared database. Extension schema changes go through this Rho-owned Prisma migration flow so existing apps and user data stay coordinated. Rho must not reset or delete existing data unless the user explicitly approved that destructive change.

## Applying schema changes to a running server

Never kill or restart the rho server to apply schema changes. The server
hosts the agent's own session and the user's background tasks; a restart
kills them mid-run. `rho_reload` swaps the regenerated database client into
the running server, so new models work without a restart.

Validate on a copy before touching the live database:

1. Edit the canonical schema, then snapshot the live database file:

   ```sh
   bun -e "const { Database } = require('bun:sqlite'); const db = new Database('<live db file>'); db.exec(\"VACUUM INTO '<copy file>'\"); db.close()"
   ```

2. Create the migration and apply it to the copy first, from `packages/core`:

   ```sh
   DATABASE_URL=file:<copy file> bun run db:migrate -- --name <change>
   ```

3. For risky changes, boot a disposable test server against the copy and
   check it, then kill only that test server:

   ```sh
   RHO_PORT=7332 RHO_DATABASE_URL=file:<copy file> bun apps/server/dist/cli.js
   ```

4. Apply the now-validated migration to the live database:

   ```sh
   DATABASE_URL=<live url> bunx prisma migrate deploy --config prisma.config.ts
   ```

5. Regenerate the client (`bun run db:generate`), then call `rho_reload`.
   New models are usable immediately; no rebuild or restart is needed.

## Extension data

An extension running standalone uses its package schema and a local database that belongs to that standalone run. This does not change the user's Rho runtime database.

An installed extension uses the shared runtime database. Its data requirements are merged into `db/schema.prisma`, then applied to `db/rho.sqlite` by Rho.

If compatible data already exists, Rho reuses it instead of creating duplicate app-specific tables.

## User experience

Normal users should not need to understand tables, columns, Prisma models, or migrations.

When Rho can safely set up the database, it does the work and summarizes the result simply. When a decision affects user data, Rho asks in product terms and provides a recommended default.

## Next

- [Extensions](extensions.md)
