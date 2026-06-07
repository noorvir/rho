# Current Work: Prisma Contacts Data Table

## Goal

Set up a SQLite database managed by Prisma and use rho's web data table to visualize personal contacts from that database.

## Status

Done for now. The web shell includes a Data section that lists SQLite tables and renders selected table data through the core API.

## Decisions

- Use the latest Prisma packages available through the package manager.
- Keep the first schema small and useful: a single personal contacts table with mostly required fields.
- Store realistic personal demo contact data through a seed script.
- Use Prisma to manage the SQLite schema and seed data.
- Use direct SQLite introspection/querying for the data-table API; do not parse Prisma schema, infer semantic presentation, or make the table viewer depend on Prisma metadata.
- Reuse the existing shadcn/TanStack data table foundation in `apps/web`.
- Use React Query for browser async state.
- Keep the hand-written `apps/web` core API boundary temporary; replace it later with a generated OpenAPI/oRPC-style client when the core API contract is ready.
- Do not move this app-specific table/design work into `packages/ui`; that package is for user extension/app components.

## Scope

- Add Prisma schema/config for SQLite.
- Add a `Contact` model with personal address-book fields.
- Add a seed script for demo contacts.
- Add a core API endpoint for table data.
- Add a Data section in the web shell that lists SQLite tables and renders the selected table.
- Validate with typecheck/build and visual browser inspection.

## Constraints

- Browser code must not import Prisma client or access SQLite directly.
- Prefer required fields unless absence is normal for a personal contact.
- Keep optional fields limited to genuinely optional data such as email, phone, location, birthday, notes, or last-contact dates.
- Preserve the current dense table design and shadcn/TanStack data-table pattern.
- Keep the implementation direct; avoid generic database/admin frameworks.

## Next Steps

- [x] Install Prisma packages and initialize SQLite schema/config.
- [x] Define the personal contacts/org models and generate the Prisma client.
- [x] Add seed data and seed command.
- [x] Add SQLite table data access and core API endpoint.
- [x] Update the Data section to build columns/renderers from direct SQLite table metadata.
- [x] Move browser data loading to React Query.
- [x] Run validation and visually verify the table.
- [ ] Later: replace the temporary hand-written core API client with generated OpenAPI/oRPC-style bindings.
