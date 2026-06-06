# Rho agent notes

## Web UI

- For `apps/web` scrollable regions, use Tailwind scrollbar utilities backed by design-system CSS variables. Keep scrollbar size, thumb, hover, and track colors in `apps/web/src/styles.css`; do not leave native-looking scrollbars or one-off scrollbar colors in component code.

## Package boundaries

- `packages/ui` is for reusable components that help people build rho user extensions/apps. Do not use it as the dumping ground for `apps/web` shell-only components or the first-party web app design system.
