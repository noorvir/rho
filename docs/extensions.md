---
title: Extensions
description: Extension package shape, installed and standalone modes, runtime loading, and trust model.
tags:
  - extensions
  - apps
  - runtime
---

# Extensions

Rho extensions are source-code packages that add apps, channels, or agent capabilities to Rho.

The app extension path is the primary extension path. Use the app SDK init script to create one from the built-in template, then install or load the extension through Rho.

In a running runtime, extensions live in the extensions workspace at
`$RHO_HOME/extensions` (default `~/.rho/extensions`). Create each extension
as a folder there; the workspace's shared `package.json` already provides
`@rho/apps-sdk`, `@rho/ui`, React, and oRPC. After adding a folder with its
own `package.json`, run `bun install` in `$RHO_HOME/extensions`, then call
`rho_reload`. Always run `bun install` from the workspace root — running it
inside an app folder corrupts the shared dependency links. The `examples/extensions` paths below apply when developing
rho itself from the source repository.

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

## Extension data

The extension definition context provides `rho.db`, the shared runtime
database client (Prisma) over the canonical Rho schema. API handlers persist
app data through it:

```ts
export function createRouter({ api, db }: RhoExtensionContext) {
	return {
		list: api.handler(async () => ({ items: await db.todo.findMany() })),
	};
}
```

Models used by an extension must exist in the runtime schema first. Adding or
changing models follows the Rho-managed migration flow in
[Database](database.md); after the schema change is applied and the client is
regenerated, reload the runtime.

## Crons

Installed extension code can register durable crons with `rho.cron(...)`. A cron has a stable id and a function reference from the currently loaded extension code. Rho stores the schedule and run state in the runtime database, but it does not store a function name to call later.

```ts
import { defineExtension } from "@rho/apps-sdk";

export default defineExtension(async (rho) => {
	rho.cron({
		id: "todo-list.daily-digest",
		title: "Todo daily digest",
		schedule: {
			kind: "cron",
			expression: "0 8 * * *",
			timezone: rho.user.timezone,
		},
		enabled: true,
		run: async ({ db }) => {
			const todos = await db.todo.findMany({ where: { done: false } });
			console.log(`Todo digest found ${todos.length} open items.`);
		},
	});

	return { apps: [] };
});
```

Use `kind: "at"` for one-shot work and `kind: "cron"` for recurring work. The timezone is always concrete; `rho.user.timezone` is the runtime's default user timezone.

Rho reconciles crons on reload. Re-registering the same id updates the schedule/function binding without duplicating the cron. If a cron is no longer registered by loaded code, Rho disables it and records a visible error instead of calling stale code.

User-created reminders are agent crons with `purpose = "reminder"`. Other scheduled agent work uses `purpose = "scheduled_task"`. Extension crons are also stored as scheduled tasks so app-owned polling/sync jobs do not appear in reminder lists.

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
