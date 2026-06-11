# Rho agent notes

## Documentation

- Use the Todo app (`todo-list`, `Todo List`) as the canonical running example in Rho docs and README/quickstart examples. Make sample app/API snippets explicitly examples; use another example domain only when the task asks for it.
- When documenting Rho's agent terminal, describe the pi relationship plainly: Rho wraps the pi coding agent, pi workflows work in Rho, and attribution should be factual.
## Web UI

- For `apps/server/web` scrollable regions, use Tailwind scrollbar utilities backed by design-system CSS variables. Keep scrollbar size, thumb, hover, and track colors in `apps/server/web/src/styles.css`; do not leave native-looking scrollbars or one-off scrollbar colors in component code.

## Server data

- For Prisma-backed domain code, Prisma schema and generated client types are the source of truth. Do not add DTO/interface mirrors for Prisma models or relation query results; derive types from Prisma query args/payloads.
- For SQLite table-browser features, the SQLite database is the source of truth. Query SQLite directly with SQL/PRAGMA for table metadata and rows; do not parse Prisma schema or build Prisma-model interpreters for the table viewer.
- Keep the table viewer plain: display the actual SQLite columns and row values. Do not add relation expansion, domain-specific column combining, semantic column ordering, or custom display fields. Add only generic table mechanics such as pagination, filtering, ordering, and type-based cell rendering.
- Table viewer booleans render as checkboxes, green when checked. Enum columns render as pills.

## Server runtime

- Runtime configuration must be loaded through runtime-package env modules, not library packages. Do not read `process.env` outside a runtime-owned `env.ts` boundary. Env object fields should use the uppercase runtime variable name, such as `env.RHO_DATABASE_URL`, not one-off exported aliases. Library packages such as `packages/core` and `packages/ai` must receive runtime configuration through explicit options.
- Treat `process.cwd()`, home-directory defaults, and relative paths as runtime context like env. Runtime entrypoints (`apps/server`, `packages/cli`) must resolve filesystem paths to absolute paths before passing them into library packages; `packages/core` and `packages/ai` should not use cwd as a fallback or path-resolution base.
- `apps/server` extension paths are runtime configuration. Load them through `RHO_EXTENSION_PATHS` or a server env helper; keep example extension paths in root/dev scripts or docs, not in server entrypoints.
- Browser app/API requests authenticate through `RhoAuth` session cookies or bearer tokens. Never put secrets in `VITE_*` variables or anything else that ends up in the client bundle.

## Server HTTP

- In `apps/server/src/http`, feature files should export `*Router()` functions with route definitions, schemas, handlers, local auth middleware, and small helpers kept in the same file. Keep `index.ts` as composition only.
- In `apps/server/src/http` routers, await service/core calls into named variables and wrap them with `tc(...)`; map failures to `ORPCError` at the HTTP boundary. Do not inline awaited calls in returned objects, conditions, or handler arguments.

## Package boundaries

- `packages/ui` is for reusable components that help people build rho user extensions/apps. Do not use it as the dumping ground for `apps/server/web` shell-only components or the first-party web app design system.
- `packages/core` owns native rho runtime/state/db/channel orchestration APIs. Keep Hono routes, HTTP payload validation/conversion, HTTP conversation keys, SSE streaming, and `HttpChannel` ownership in `apps/server`.
- Shared extension/app types must have one canonical owner. Do not redeclare `AppExtension`, `AppRoute`, `AppApi`, or `AppClient` mirrors in `packages/apps-sdk`; import/re-export the canonical types, or extract a shared types package only when the dependency boundary requires it.
