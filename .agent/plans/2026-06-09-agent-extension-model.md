# Current Work: Rho Agent Extension Model

## Goals

Add `AgentExtension` as a first-class Rho extension type for extending the Rho agent runtime.

`AgentExtension` should support existing Pi-compatible extensions directly. Rho should not translate Pi extensions into a reduced or parallel capability system.

## Non-goals

- Implementing the full Rho agent runtime.
- Building the Rho CLI or TUI.
- Exposing Pi branding or Pi product concepts in user-facing Rho UI.
- Creating a marketplace or sandbox model.
- Replacing app or channel extension loading.

## Proposed Shape

Keep `AgentExtension` as a member of the Rho extension union:

```ts
type Extension = AppExtension | ChannelExtension | AgentExtension;
```

`AgentExtension` means a Rho extension contribution that extends the Rho agent runtime.

The type should preserve both Pi extension loading paths:

```ts
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

interface AgentExtension extends ExtensionBase<"agent"> {
  sources: AgentExtensionSource[];
}

type AgentExtensionSource =
  | { type: "path"; path: string }
  | { type: "factory"; factory: ExtensionFactory };
```

Rho maps path sources to Pi `DefaultResourceLoader.additionalExtensionPaths` and factory sources to `DefaultResourceLoader.extensionFactories`.

## User-Facing Contract

Docs and extension authoring APIs should describe this as a Rho agent extension. Implementation docs may say that an agent extension source is a Pi-compatible extension module or factory.

Normal users should not need to know Pi is the implementation layer.

## Success Criteria

- [ ] `AgentExtension` exists in the canonical Rho extension type family.
- [ ] Extension definitions can return agent extension contributions alongside app and channel contributions.
- [ ] Pi-compatible extension paths can be declared through `AgentExtension`.
- [ ] Pi-compatible extension factories can be declared through `AgentExtension`.
- [ ] The Rho agent runtime can collect agent extension sources and pass them to Pi's resource loader.
- [ ] Docs explain the Rho-facing concept without exposing Pi as the product identity.

## Tests / Validation

- Typecheck the extension packages touched by the change.
- Add or update focused loader tests if existing extension loader coverage has a natural boundary for app/channel/agent contribution parsing.
- Validate with a small Pi-compatible extension source that registers a harmless agent capability.
- Verify existing app and channel extension loading still works.
