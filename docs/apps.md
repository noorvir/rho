# Apps

Rho apps are React surfaces provided by app extensions.

Apps render inside the Rho `/apps` shell. They are not standalone web pages: the shell owns the outer layout, authentication, app list, route mounting, and app context. The app owns the UI inside its app surface.

This page uses a Todo app as the running example.

## How apps are registered

An app extension registers apps from its Rho entrypoint with `createAppExtension`.

Example Todo app registration:

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

Rules:

- `slug` must be lowercase kebab-case.
- `name` is shown to the user in the app shell.
- `client.entry` points to the app's React entrypoint, relative to the extension entrypoint file.
- `routes` lists the app routes shown by the shell.
- route paths are normalized to start with `/`.
- route paths must be unique within the app.
- `api.router` is optional.

## Where apps render

The app shell mounts apps under `/apps`.

| Shell URL | App route path |
|-----------|----------------|
| `/apps` | app list |
| `/apps/todo-list` | `/` |
| `/apps/todo-list/items` | `/items` |

The shell loads the app's client module dynamically. The module must default-export the app wrapped with `rhoApp()`, which makes it a standalone bundle that mounts itself with its own React and query client.

```tsx
import { rhoApp } from "@rho/apps-sdk/react";

function App() {
  return <main>Todo List</main>;
}

export default rhoApp(App);
```

`rhoApp()` renders `RhoAppProvider` inside the bundle, so app code can call `useRhoApp()`.

## App routing

Rho passes the active app route as `rho.app.routePath`.

Route inside the app by switching on that value:

```tsx
import { rhoApp, useRhoApp } from "@rho/apps-sdk/react";
import { Home } from "./routes/index.tsx";
import { Items } from "./routes/items.tsx";

function TodoListApp() {
  const rho = useRhoApp();

  switch (rho.app.routePath) {
    case "/":
      return <Home />;
    case "/items":
      return <Items />;
    default:
      return <main>Route not found: {rho.app.routePath}</main>;
  }
}

export default rhoApp(TodoListApp);
```

Navigate between app routes with `rho.navigate("/items")` — no page reload.
Keep the route list in `createAppExtension` and the route switch in `app.tsx` in sync.

## App context

Use `useRhoApp()` from `@rho/apps-sdk/react` to access the app context.

```tsx
import { useRhoApp } from "@rho/apps-sdk/react";

export function Home() {
  const rho = useRhoApp();

  return (
    <main>
      <h2>{rho.app.name}</h2>
      <p>Mounted at {rho.app.basePath}</p>
    </main>
  );
}
```

The context contains:

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
}
```

Use the context for mount information, not for routine API calls.

For links inside the app, derive URLs from `rho.app.basePath` instead of writing the shell path by hand:

```tsx
const rho = useRhoApp();
const itemsHref = `${rho.app.basePath}/items`;
```

Do not hard-code the app slug into URLs:

```tsx
// Avoid this inside app code.
const itemsHref = "/apps/todo-list/items";
```

For app API calls, prefer the typed oRPC client described below. `rho.apiBasePath`, `rho.apiUrl()`, `rho.apiHeaders()`, and `rho.apiFetch()` are low-level utilities for setting up that client or making an occasional raw request.

## App APIs

Apps can define server-side API handlers with oRPC.

Example Todo API:

```ts
import type { RhoAppApiBuilderContext } from "@rho/apps-sdk";

const todos = [
  { id: "buy-milk", title: "Buy milk", completed: false },
  { id: "book-run", title: "Book morning run", completed: true },
];

export type TodoRouter = ReturnType<typeof createRouter>;

export function createRouter({ api }: RhoAppApiBuilderContext) {
  return {
    todos: api.handler(({ context }) => ({
      todos,
      platform: context.host.platform,
    })),
  };
}
```

The array in this example is only sample data. Real apps should load data from the runtime services available to the extension.

The shell mounts app APIs under the app path. The default API base path is:

```txt
/apps/<slug>/api
```

For the Todo app, the API base path is:

```txt
/apps/todo-list/api
```

App API requests are authenticated by the Rho server. The app context adds the `X-Rho-Platform` header through `apiHeaders()` and `apiFetch()`.

## Typed API client

Use `@orpc/client`, `@orpc/react-query`, and `@tanstack/react-query` for normal app API calls. App components should usually call `useApi()` and React Query instead of calling `rho.apiFetch()` directly.

```ts
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import type { RouterClient } from "@orpc/server";
import type { RhoAppContext } from "@rho/apps-sdk";
import { useRhoApp } from "@rho/apps-sdk/react";
import { useMemo } from "react";
import type { TodoRouter } from "./api.ts";

export type ApiClient = RouterClient<TodoRouter>;

export function createOrpcClient(rho: RhoAppContext): ApiClient {
  const link = new RPCLink({
    url: new URL(rho.app.apiBasePath, window.location.origin).toString(),
    headers: () => rho.apiHeaders(),
  });

  return createORPCClient<ApiClient>(link);
}

export function useApi() {
  const rho = useRhoApp();
  return useMemo(() => createORPCReactQueryUtils(createOrpcClient(rho)), [rho]);
}
```

Then call the API from route components:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useApi } from "../client.ts";

export function Items() {
  const api = useApi();
  const todos = useQuery(api.todos.queryOptions());

  return (
    <main>
      {(todos.data?.todos ?? []).map((todo) => (
        <article key={todo.id}>{todo.title}</article>
      ))}
    </main>
  );
}
```

## URL state

Store app state in the URL query string when the state should survive refresh, back/forward navigation, or shared links.

Good query-param state:

- selected tab
- search text
- filters
- sort order
- pagination
- selected date or date range
- lightweight view mode

For the Todo app, a filtered route can look like:

```txt
/apps/todo-list/items?filter=open&sort=created
```

Use local React state for temporary UI state that does not belong in a link, such as open menus, draft form fields, hover state, or optimistic UI details.

Do not put secrets, access tokens, large payloads, or private draft content in query params.

## Responsive design

Design mobile-first. Rho apps render inside a shell that also needs to work across web and mobile hosts.

App UI should:

- work at narrow widths first
- use normal document flow, flex, and grid instead of fixed positioning
- avoid assuming it owns the whole browser window
- avoid hard-coded desktop-only widths
- keep touch targets usable
- let content scroll naturally inside the shell
- use `rho.host.platform` only for real platform differences

The web shell renders apps inside a padded `/apps` surface. The same app component should render correctly in any host that provides the Rho app context.

## Available app utilities

App extensions commonly use:

| Package | Purpose |
|---------|---------|
| `@rho/apps-sdk` | `defineExtension`, `createAppExtension`, app and API context types. |
| `@rho/apps-sdk/react` | `RhoAppProvider`, `useRhoApp`. |
| `@orpc/server` | app API handlers and router types. |
| `@orpc/client` | typed client creation for app APIs. |
| `@orpc/react-query` | React Query helpers for oRPC clients. |
| `@tanstack/react-query` | client-side async state and caching. |
| `react` | app UI components. |

## Next

- [Rho packages](packages.md)
