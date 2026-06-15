---
title: SDK
description: Public APIs from @rho/apps-sdk for app extension definitions, React context, and typed app APIs.
tags:
  - sdk
  - apps
  - api
  - react
---

# SDK

Rho app extensions use `@rho/apps-sdk`.

The SDK exposes helpers for defining app extensions, reading app context in React, and typing app APIs.

## Entrypoints

`@rho/apps-sdk` has two public imports:

```ts
import { createAppExtension, defineExtension } from "@rho/apps-sdk";
import { useRhoApp } from "@rho/apps-sdk/react";
```

Use `@rho/apps-sdk` from extension entrypoints and API files. Use `@rho/apps-sdk/react` from React app components.

## `defineExtension`

`defineExtension` wraps the default-exported extension definition function.

```ts
import { createAppExtension, defineExtension } from "@rho/apps-sdk";
import { createRouter } from "./api.ts";

export default defineExtension(async (rho) => ({
  apps: [
    createAppExtension({
      slug: "todo-list",
      name: "Todo List",
      client: { entry: "./app.tsx" },
      routes: [{ path: "/", label: "Home" }],
      api: { router: createRouter(rho) },
    }),
  ],
}));
```

The function receives `RhoExtensionContext`, which exposes the app API builder context used to create oRPC handlers.

## `createAppExtension`

`createAppExtension` validates and normalizes an app definition.

```ts
createAppExtension({
  slug: "todo-list",
  name: "Todo List",
  client: { entry: "./app.tsx" },
  routes: [
    { path: "/", label: "Home" },
    { path: "/items", label: "Items" },
  ],
});
```

It enforces:

- `slug` is lowercase kebab-case
- `name` is non-empty
- `client.entry` is non-empty
- route paths start with `/`
- route labels are non-empty when provided
- route paths are unique within the app

If `api.basePath` is omitted, it defaults to `/api`.

## App API context

App APIs use the `api` builder from `RhoAppApiBuilderContext`.

```ts
import type { RhoAppApiBuilderContext } from "@rho/apps-sdk";

export type TodoRouter = ReturnType<typeof createRouter>;

export function createRouter({ api }: RhoAppApiBuilderContext) {
  return {
    todos: api.handler(({ context }) => ({
      app: context.app.slug,
      platform: context.host.platform,
      todos: [],
    })),
  };
}
```

Name public app API procedures after the user-facing resource or action, such as `list`, `detail`, `create`, `update`, `remove`, or `markWatered`. Avoid a procedure literally named `get`; use `detail`, `item`, or the resource name instead.

Handler context includes:

```ts
interface RhoAppApiContext {
  app: {
    slug: string;
    name: string;
    basePath: string;
    apiBasePath: string;
  };
  host: {
    platform: "web" | "mobile" | "desktop";
  };
}
```

## React app context

Use `useRhoApp()` from `@rho/apps-sdk/react` inside app components.

```tsx
import { useRhoApp } from "@rho/apps-sdk/react";

export function Home() {
  const rho = useRhoApp();

  return <h1>{rho.app.name}</h1>;
}
```

`useRhoApp()` returns:

```ts
interface RhoAppContext {
  app: {
    slug: string;
    name: string;
    basePath: string;
    apiBasePath: string;
    routePath: string;
  };
  host: {
    platform: "web" | "mobile" | "desktop";
  };
  apiUrl(path: string): string;
  apiHeaders(): Record<string, string>;
  apiFetch(path: string, init?: RequestInit): Promise<Response>;
  navigate(routePath: string): void;
}
```

Use `rho.app.routePath` for app routing and `rho.navigate()` to switch app
routes without a page reload. Use `rho.app.basePath` for link hrefs. Use the
typed oRPC client for normal app API calls.

## `rhoApp`

`rhoApp(App)` wraps the app's root React component as a mountable rho app and
is the required default export of the client entry. The wrapper owns the
app's React root, context provider, and query client inside the app bundle,
so apps stay fully standalone from the shell.

## `RhoAppProvider`

`RhoAppProvider` provides `RhoAppContext` to React components.

App authors usually do not need to use it directly because `rhoApp()` renders it inside the app bundle. It is exported for tests and custom hosts.

```tsx
import { RhoAppProvider } from "@rho/apps-sdk/react";

<RhoAppProvider context={context}>
  <App />
</RhoAppProvider>;
```

## Exported types

`@rho/apps-sdk` exports the public app and extension types:

```ts
import type {
  AppClient,
  AppExtension,
  AppRoute,
  RhoAppApiBuilderContext,
  RhoAppApiContext,
  RhoAppContext,
  RhoDb,
  RhoExtensionContext,
  RhoExtensionDefinition,
  RhoHostPlatform,
  RhoModelDelegate,
  RhoRuntimeModels,
} from "@rho/apps-sdk";
```

Use these types when writing extension entrypoints, app API files, custom clients, tests, or custom hosts. App extensions should not import from `@rho/core`; declare extension-added database models by augmenting `@rho/apps-sdk` from `src/models.d.ts`.

## Related utilities

Rho app extensions commonly combine the SDK with:

| Package | Purpose |
|---------|---------|
| `@orpc/server` | app API handlers and router types. |
| `@orpc/client` | typed app API client. |
| `@orpc/react-query` | React Query helpers for oRPC clients. |
| `@tanstack/react-query` | async state and caching in app components. |
| `react` | app UI. |

## Next

- [Security](security.md)
