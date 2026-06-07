# Rho agent notes

## Web UI

- For `apps/server/web` scrollable regions, use Tailwind scrollbar utilities backed by design-system CSS variables. Keep scrollbar size, thumb, hover, and track colors in `apps/server/web/src/styles.css`; do not leave native-looking scrollbars or one-off scrollbar colors in component code.

## Server data

- For Prisma-backed domain code, Prisma schema and generated client types are the source of truth. Do not add DTO/interface mirrors for Prisma models or relation query results; derive types from Prisma query args/payloads.
- For SQLite table-browser features, the SQLite database is the source of truth. Query SQLite directly with SQL/PRAGMA for table metadata and rows; do not parse Prisma schema or build Prisma-model interpreters for the table viewer.
- Keep the table viewer plain: display the actual SQLite columns and row values. Do not add relation expansion, domain-specific column combining, semantic column ordering, or custom display fields. Add only generic table mechanics such as pagination, filtering, ordering, and type-based cell rendering.
- Table viewer booleans render as checkboxes, green when checked. Enum columns render as pills.

## Package boundaries

- `packages/ui` is for reusable components that help people build rho user extensions/apps. Do not use it as the dumping ground for `apps/server/web` shell-only components or the first-party web app design system.
- `packages/core` owns native rho runtime/state/db/channel orchestration APIs. Keep Hono routes, HTTP payload validation/conversion, HTTP conversation keys, SSE streaming, and `HttpChannel` ownership in `apps/server`.
