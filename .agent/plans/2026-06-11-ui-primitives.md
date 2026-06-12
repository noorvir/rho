# Current Work: UI primitives for agent-built apps

## Goals

Agent-built app UIs should render correctly and look clean by default, on web
and in the mobile webview, without the agent thinking about design. Two
levers:

1. A small primitive library (`@rho/ui`, installed via the apps-sdk template)
   that owns macro structure and platform correctness: screens, sections,
   lists, form fields, navigation links, empty/loading/error states.
2. A short design doctrine in the app-building docs so the agent composes
   primitives instead of hand-rolling boxes.

The defining failure mode to eliminate: **nested bordered cards**. Chrome must
be contextual, not compositional — only one surface level ever renders, by
construction (depth-aware components), not by prompt discipline.

## Non-goals

- Controlling the user's aesthetic. Primitives own structure and correctness;
  color, content layout, and creativity stay with Tailwind and the agent.
- Micro-layout primitives (VStack/HStack) — Tailwind flex already does this.
- Form state machinery (validation, submit orchestration) — visual field
  wrappers only.
- Mobile shell changes. The shell header is going away separately; `Screen`
  owns the page title.

## Current Direction

- No `Card` export at all. The only surfaces are `List` (grouped rows) and
  inputs/buttons; `Section` is a pure semantic group (small uppercase title +
  spacing, never a border). A shared depth context flattens any accidentally
  nested surface.
- SwiftUI-flavored semantics: `Screen` > `Section` > `List`/`Row`, `Field` +
  inputs, `Link`/`Row href` wrapping `rho.navigate` so client-side navigation
  is automatic.
- Platform correctness baked in: ≥16px inputs on small screens (no iOS focus
  zoom), ≥44px tap targets, theme tokens from the shell's CSS variables.
- The template is the strongest prompt: scaffold and example apps use the
  primitives, so generated apps start from canonical usage. `className`
  passthrough everywhere as the escape hatch.
- Web first; mobile verification after the web look is approved.

## Success Criteria

- [ ] `@rho/ui` exports Screen, Section, List, Row, Field, TextInput,
      TextArea, Select, Checkbox, Button, Badge, Link, EmptyState,
      ErrorState, Spinner.
- [ ] Nested surfaces physically cannot render border-in-border.
- [ ] Row/Link navigation is client-side (no full page reload) with working
      hrefs.
- [ ] Per-app CSS includes classes used inside `@rho/ui`.
- [ ] Template + both example apps build UI from primitives; docs carry the
      design doctrine.
- [ ] Todo and workout apps look clean on the web dashboard and embed
      surfaces.

## Tests / Validation

- `bun run typecheck`, server typecheck, biome.
- Prod-mode server: `/apps/<slug>/client.js` + `client.css` build for both
  examples; CDP screenshots of dashboard + embed for visual review.
- Click-through: workout day navigation stays client-side.

## Progress

- [x] Design discussion with user: primitive set, no-Card decision, light
      default aesthetic (iOS-grouped-leaning), user creativity preserved.
- [x] Implement `@rho/ui` package + wiring (tsconfig refs, Dockerfile build,
      app CSS `@source`).
- [x] Template + docs doctrine.
- [x] Convert todo-list and workout-tracker examples.
- [x] Adoption test passed: agent built reading-list from product
      requirements alone, used primitives correctly, zero nested cards.
- [x] `Screen back` slot for detail screens; doctrine: shell owns global
      navigation, no app-level breadcrumbs/nav bars.
- [ ] Web visual review with user; iterate.
- [ ] Later iteration: mobile pass, more inputs (date/switch), Row trailing
      actions.
