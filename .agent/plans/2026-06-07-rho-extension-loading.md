# Rho Extension Loading Plan

## Goal

Design a file-based extension mechanism for rho so installed source-code extensions can contribute native runtime capabilities, starting with channels, without mixing HTTP serving, extension discovery, reload orchestration, or channel replacement concerns.

## Pi Research Summary

Pi's extension model has three durable ideas worth copying:

- Extensions are source modules loaded from conventional filesystem locations and optional configured paths.
- Each extension exports a default factory function that receives a narrow registration API.
- Loading, registration, runtime application, and reload lifecycle are separate phases.

Pi discovery shape:

- Project-local and global extension directories are scanned.
- Direct files and one-level subdirectories with an entrypoint are supported.
- Package directories can declare extension entrypoints in package metadata.
- TypeScript source is loaded directly at runtime through a TS-aware module loader.
- Extension dependencies resolve from the extension/package directory.
- Reload tears down old extension runtime, reloads sources/resources, then starts the new runtime; code after reload must treat previous in-memory extension state as stale.

Relevant Pi constraints to preserve conceptually:

- Extensions execute trusted arbitrary code.
- Extension load errors should be reported without corrupting the core runtime.
- Provenance should be tracked explicitly instead of inferred from names.
- Hot reload should replace registrations atomically at the application boundary.

## Proposed Rho Shape

Use extensions as code that registers capabilities with rho core. For now, keep the API intentionally small and channel-focused.

```ts
export type RhoExtension = (rho: RhoExtensionApi) => void | Promise<void>;

export interface RhoExtensionApi {
  registerChannel(channel: Channel): void;
}
```

Extensions should be boring source files:

```ts
import type { RhoExtensionApi } from "@rho/core";
import { TelegramChannel } from "./telegram-channel";

export default function extension(rho: RhoExtensionApi) {
  rho.registerChannel(new TelegramChannel({ token: process.env.TELEGRAM_TOKEN }));
}
```

## Source Layout

Add a first-class extensions area in core code, with loading mechanics kept under a loader subfolder:

```txt
packages/core/src/extensions/
  index.ts
  types.ts
  collector.ts
  loader/
    discover.ts
    file.ts
    package.ts
    source-module.ts
    index.ts
```

The loader folder owns the different loading modes:

- file entrypoints: direct `.ts` / `.js` extension files
- folder entrypoints: `index.ts` / `index.js`
- package entrypoints: `package.json` manifest entries
- source-module import: TS-aware runtime import and default-export validation

Keep these files about extension loading only. Channel installation stays in core runtime/application code.

## Separation of Concerns

Keep four separate concepts:

1. **Discovery**
   - Finds extension entrypoints from configured directories/files.
   - Returns paths/provenance only.
   - Does not import extension code.
   - Does not touch the runtime.

2. **Loading**
   - Imports extension modules.
   - Validates the default export shape.
   - Executes factories against a registration collector.
   - Produces a loaded extension result plus diagnostics.
   - Does not mutate the live runtime directly.

3. **Application**
   - Takes loaded registrations and applies them to core.
   - For channels, calls the existing channel replacement primitive.
   - This is where atomic replacement belongs.

4. **Reload command**
   - Orchestrates discovery → loading → application.
   - Reports diagnostics.
   - Does not contain channel-specific install logic.

## Pseudocode

```ts
async function reloadExtensions(core: RhoCore, loader: ExtensionLoader) {
  const discovered = await loader.discover();
  const loaded = await loader.load(discovered);

  if (loaded.fatalDiagnostics.length > 0) {
    return { ok: false, diagnostics: loaded.diagnostics };
  }

  core.replaceChannels(loaded.channels);

  return {
    ok: true,
    extensions: loaded.extensions,
    channels: core.activeChannelIds(),
    diagnostics: loaded.diagnostics,
  };
}
```

```ts
class ExtensionCollector implements RhoExtensionApi {
  channels: Channel[] = [];

  registerChannel(channel: Channel) {
    this.channels.push(channel);
  }
}
```

```ts
async function loadExtension(path: string) {
  const mod = await importSourceModule(path);
  if (typeof mod.default !== "function") {
    return { diagnostics: ["missing default extension factory"] };
  }

  const collector = new ExtensionCollector();
  await mod.default(collector);

  return { channels: collector.channels, diagnostics: [] };
}
```

## Initial Scope

- Create `packages/core/src/extensions/` and `packages/core/src/extensions/loader/` as the extension boundary.
- Support project-local source-file extensions first.
- Mirror Pi's entrypoint shapes at the design level: direct files, folder index files, and package manifest entries.
- Support a single default-export factory shape.
- Support `registerChannel` only.
- Keep HTTP server code out of core extension APIs.
- Keep table/admin routes unrelated to extension loading.
- Leave package installation, dependency management, settings UI, and marketplace-style distribution for later.

## Open Questions

- Exact rho extension directory names and precedence: project-only first, or project plus user-global now?
- Should failed extension loads block all reload, or apply valid extensions and report failed ones?
- Do channels need lifecycle teardown before replacement, or is runtime replacement enough for the current `Channel` contract?
- Should extension reload preserve existing built-in/server-owned channels, or should server-owned channels stay entirely outside core registration?
