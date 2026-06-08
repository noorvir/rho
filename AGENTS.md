# Rho agent notes

## Web UI

- For `apps/server/web` scrollable regions, use Tailwind scrollbar utilities backed by design-system CSS variables. Keep scrollbar size, thumb, hover, and track colors in `apps/server/web/src/styles.css`; do not leave native-looking scrollbars or one-off scrollbar colors in component code.

## Server data

- For Prisma-backed domain code, Prisma schema and generated client types are the source of truth. Do not add DTO/interface mirrors for Prisma models or relation query results; derive types from Prisma query args/payloads.
- For SQLite table-browser features, the SQLite database is the source of truth. Query SQLite directly with SQL/PRAGMA for table metadata and rows; do not parse Prisma schema or build Prisma-model interpreters for the table viewer.
- Keep the table viewer plain: display the actual SQLite columns and row values. Do not add relation expansion, domain-specific column combining, semantic column ordering, or custom display fields. Add only generic table mechanics such as pagination, filtering, ordering, and type-based cell rendering.
- Table viewer booleans render as checkboxes, green when checked. Enum columns render as pills.

## Server runtime

- Runtime configuration must be loaded through runtime-package env modules, not core internals. Do not read `process.env` outside an `env.ts` boundary. Env object fields should use the uppercase runtime variable name, such as `env.RHO_DATABASE_URL`, not one-off exported aliases. Core packages should receive runtime configuration through explicit options.
- `apps/server` extension paths are runtime configuration. Load them through `RHO_EXTENSION_PATHS` or a server env helper; keep example extension paths in root/dev scripts or docs, not in server entrypoints.
- Browser app/API auth is not implemented yet. Do not treat `VITE_*` secrets as real browser auth; add a proper shell/app session or capability model before considering app APIs production-ready.

## Server HTTP

- In `apps/server/src/http`, feature files should export `*Router()` functions with route definitions, schemas, handlers, local auth middleware, and small helpers kept in the same file. Keep `index.ts` as composition only.
- In `apps/server/src/http` routers, await service/core calls into named variables and wrap them with `tc(...)`; map failures to `ORPCError` at the HTTP boundary. Do not inline awaited calls in returned objects, conditions, or handler arguments.

## Package boundaries

- `packages/ui` is for reusable components that help people build rho user extensions/apps. Do not use it as the dumping ground for `apps/server/web` shell-only components or the first-party web app design system.
- `packages/core` owns native rho runtime/state/db/channel orchestration APIs. Keep Hono routes, HTTP payload validation/conversion, HTTP conversation keys, SSE streaming, and `HttpChannel` ownership in `apps/server`.
- Shared extension/app types must have one canonical owner. Do not redeclare `AppExtension`, `AppRoute`, `AppApi`, or `AppClient` mirrors in `packages/apps-sdk`; import/re-export the canonical types, or extract a shared types package only when the dependency boundary requires it.
