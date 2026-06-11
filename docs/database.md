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

Apply schema changes in the source repo with, from `packages/core`:
`DATABASE_URL=<runtime database url> bun run db:migrate -- --name <change>`
then `bun run db:generate`. The dev server restarts automatically when the
generated client changes.

## Ownership

Rho owns `db/schema.prisma`. That file is the only schema file for the installed runtime.

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

## Extension data

An extension running standalone uses its package schema and a local database that belongs to that standalone run. This does not change the user's Rho runtime database.

An installed extension uses the shared runtime database. Its data requirements are merged into `db/schema.prisma`, then applied to `db/rho.sqlite` by Rho.

If compatible data already exists, Rho reuses it instead of creating duplicate app-specific tables.

## User experience

Normal users should not need to understand tables, columns, Prisma models, or migrations.

When Rho can safely set up the database, it does the work and summarizes the result simply. When a decision affects user data, Rho asks in product terms and provides a recommended default.

## Next

- [Extensions](extensions.md)
