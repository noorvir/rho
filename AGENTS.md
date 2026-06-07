# Rho agent notes

## Web UI

- For `apps/web` scrollable regions, use Tailwind scrollbar utilities backed by design-system CSS variables. Keep scrollbar size, thumb, hover, and track colors in `apps/web/src/styles.css`; do not leave native-looking scrollbars or one-off scrollbar colors in component code.

## Server data

- Prisma schema and generated client types are the source of truth for server data shapes. Do not add DTO/interface mirrors for Prisma models or relation query results; derive types from Prisma query args/payloads.

## Package boundaries

- `packages/ui` is for reusable components that help people build rho user extensions/apps. Do not use it as the dumping ground for `apps/web` shell-only components or the first-party web app design system.
