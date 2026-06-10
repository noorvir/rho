# Extensions

Rho extensions are source-code packages that add apps, channels, or agent capabilities to Rho.

The app extension path is the primary extension path. Use the app SDK init script to create one from the built-in template, then install or load the extension through Rho.

## Create an app extension

From this repository, run the template script:

```bash
bun run --cwd packages/apps-sdk init "Todo List" ../../examples/extensions/todo-list
```

The command creates a package with this shape:

```txt
todo-list/
  package.json
  tsconfig.json
  src/
    extension.ts
    api.ts
    app.tsx
    client.ts
    routes/
      index.tsx
      about.tsx
```

## How Rho finds extensions

Rho loads extension entrypoints from two places:

- project extensions under `.rho/extensions`
- configured extension paths passed to the runtime

The server reads configured paths from `RHO_EXTENSION_PATHS`.

```bash
RHO_EXTENSION_PATHS=./examples/extensions/todo-list bun run --cwd apps/server dev
```

A configured path can point at an extension file or an extension directory.

## Entrypoints

Rho accepts these entrypoint shapes:

```txt
extension.ts
extension.js
extension-directory/index.ts
extension-directory/index.js
extension-directory/package.json
```

For package directories, `package.json` declares Rho entrypoints:

```json
{
  "rho": {
    "extensions": ["src/extension.ts"]
  }
}
```

Each entrypoint must default-export an extension definition function. Use `defineExtension` from `@rho/apps-sdk`.

```ts
import { createAppExtension, defineExtension } from "@rho/apps-sdk";
import { createRouter } from "./api.ts";

export default defineExtension(async (rho) => ({
  apps: [
    createAppExtension({
      slug: "todo-list",
      name: "Todo List",
      client: {
        entry: "./app.tsx",
      },
      routes: [
        { path: "/", label: "Home" },
        { path: "/items", label: "Items" },
      ],
      api: {
        router: createRouter(rho),
      },
    }),
  ],
}));
```

The `client.entry` path is resolved relative to the extension entrypoint file. If the entrypoint is `src/extension.ts`, then `client.entry: "./app.tsx"` points at `src/app.tsx`.

## Agent extensions

An extension package can also extend the Rho agent runtime by contributing agent extensions. Each agent extension declares one or more sources: a path to an agent extension module, or an inline factory.

```ts
export default defineExtension(async () => ({
	agentExtensions: [
		{
			type: "agent",
			id: "todo-list-agent",
			name: "Todo List agent tools",
			sources: [{ type: "path", path: "./agent/todo-tools.ts" }],
		},
	],
}));
```

Path sources are resolved relative to the extension entrypoint file. Agent extension sources are pi-compatible extension modules: a module default-exports a function that receives the agent extension API and can register tools, commands, and event handlers. See the [pi extension docs](https://github.com/earendil-works/pi-mono) for the module API.

Existing pi extensions and pi packages also install directly into the Rho agent with `rho install` — see [Rho Agent](agent.md).

## Standalone mode

Standalone mode runs an extension outside the user's Rho runtime.

Use standalone mode for development, tests, demos, and previews. Standalone code can use local files and local data owned by that standalone run.

Standalone mode must not modify the user's runtime database, installed extensions, or runtime schema.

## Installed mode

Installed mode runs an extension inside the user's Rho runtime.

In installed mode:

- the extension is part of the user's Rho runtime
- the extension uses runtime services provided by Rho
- Rho owns the shared database and runtime schema
- Rho applies schema changes as host operations

Installed extension code must not directly rewrite `db/schema.prisma` or run its own install-time mutation against `db/rho.sqlite`.

## Trust model

Installed extensions are trusted code. They run as part of the Rho runtime and can affect runtime data.

## Next

- [Extension structure](extension-schema.md)
