# Current Work: React UI and Web App Foundation

## Goal

Create two new React/TypeScript packages for rho:

1. **UI**: shared shell and component primitives for rho apps/extensions.
2. **Web**: rho's first-party standalone web app using TanStack Router.

## Decisions

- Use React for the shared component model.
- Use TypeScript for public contracts.
- Use oRPC for typed server/Web API contracts so Web does not redeclare route types.
- Use TanStack Router in the Web package.
- Keep the first version small and direct.
- Use Tailwind CSS and shadcn as the initial web UI foundation.
- Install the full shadcn primitive set in the Web app before design-system iteration so first-party UI is composed from shared primitives, not scratch one-offs.
- Keep shadcn customization theme-driven: change look and feel through Tailwind theme variables and CSS variables, not per-component source edits.
- Treat future end-user theme configuration as a core constraint: components should respond to CSS variable changes without code changes.

## UI Package Intent

The UI package should provide reusable primitives that make it easy for other people and AI agents to build rho user extensions/apps that render correctly inside rho.

It should own:

- reusable components for user-built rho apps/extensions
- content layout primitives that app authors can safely compose
- WebView-safe sizing, scrolling, and responsive layout conventions for embedded app content
- simple public types for rho app components

It should not own:

- `apps/web` shell-only components
- the first-party web app design system
- server API calls
- oRPC client/server wiring
- routing
- auth
- deployment config
- rho app loading/plugin machinery beyond the minimal component contract needed now

## Web Package Intent

The Web package is only for rho's first-party web app.

It should own:

- browser entrypoint
- TanStack Router setup
- first-party routes
- chat surface backed by the existing server APIs through the shared oRPC contract
- rendering rho app/content areas using the UI package
- future first-party admin/settings routes when needed

## Component Contract Direction

User-built rho apps should be simple React components rendered inside rho's shell. The shell should handle layout constraints so app authors do not need to know mobile WebView details.

Keep the first contract minimal. Do not add dynamic plugin loading, sandboxing, permission systems, registries, or broad app frameworks yet.

## Constraints

- Components must work in iOS WebView and standalone browser contexts.
- Layout should resize cleanly across mobile and desktop widths.
- Avoid implementation details leaking across package boundaries.
- Avoid unnecessary abstractions, options, and generic frameworks.
- Design-system changes should be token/CSS-variable changes first; avoid hardcoded one-off sizes, colors, padding, or radii in component source.
- Prefer spacing and separators over heavy bordered boxes for grouping; full borders should be subtle and reserved for contained surfaces.
- Data-heavy pages should use shadcn primitives such as table, separator, input, button, badge/avatar/dropdown where applicable before adding custom markup.
- TypeScript filenames must be simple kebab-case, including React component files.
- Public component names should be simple and stable.
- AI agents should be able to generate small valid components from examples.

## Next Steps

- [ ] Create the UI package skeleton and workspace wiring.
- [x] Create the Web package skeleton and workspace wiring.
- [ ] Add minimal UI shell/layout primitives.
- [x] Add TanStack Router web app entrypoint.
- [x] Set up Tailwind CSS and shadcn in the Web package.
- [x] Tune the initial theme for a tighter, squarer rho UI using Tailwind/shadcn CSS variables only.
- [x] Add a TanStack-backed shadcn Data Table renderer, extract reusable status/avatar/trend primitives from the reference table exercise, and apply them to the dashboard.
- [ ] Add typed server/Web API wiring with oRPC.
- [ ] Add a first web chat surface using existing server APIs.
- [ ] Add a small sample app/content render path to validate the UI contract.
- [x] Validate build/typecheck.
- [x] Visually validate standalone web layout.
- [ ] Visually validate iOS WebView layout before treating the shell as stable.
