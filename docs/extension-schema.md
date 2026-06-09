# Extension Structure

An app extension is a TypeScript package with a Rho entrypoint, a React app entrypoint, optional API handlers, and package metadata.

The Rho agent should create app extensions with the app SDK init script when possible. If the script is not available, it should create the same structure manually.

## Use the init script

From this repository:

```bash
bun run --cwd packages/apps-sdk init "Todo List" ../../examples/extensions/todo-list
```

The init script slugifies the name, creates a package, replaces template tokens, and renames `.template` files to normal source files.

## File tree

Create this structure manually if the init script is unavailable:

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

## `package.json`

`package.json` declares the package as an ES module and tells Rho which source files are extension entrypoints.

```json
{
  "name": "rho-app-todo-list",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@orpc/client": "^1.12.0",
    "@orpc/react-query": "^1.12.0",
    "@orpc/server": "^1.12.0",
    "@rho/apps-sdk": "0.0.0",
    "@tanstack/react-query": "^5.90.12",
    "react": "^19.2.1"
  },
  "devDependencies": {
    "@types/react": "^19.2.7",
    "typescript": "^5.9.2"
  },
  "rho": {
    "extensions": ["src/extension.ts"]
  }
}
```

The `rho.extensions` array is required for package-directory discovery. Each path is relative to the package root.

## `src/extension.ts`

`src/extension.ts` is the Rho entrypoint. It default-exports a definition function.

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
        { path: "/about", label: "About" },
      ],
      api: {
        router: createRouter(rho),
      },
    }),
  ],
}));
```

Rules:

- `slug` is lowercase kebab-case.
- `name` is the user-facing app name.
- `client.entry` points to the React app entrypoint, relative to `src/extension.ts`.
- `routes` lists app routes and shell labels.
- `api.router` is optional. Include it when the app needs server-side API handlers.

## `src/api.ts`

`src/api.ts` defines server-side handlers for the app.

```ts
import type { RhoAppApiBuilderContext } from "@rho/apps-sdk";

const items = [
  { id: "first", name: "First item" },
  { id: "second", name: "Second item" },
];

export type AppRouter = ReturnType<typeof createRouter>;

export function createRouter({ api }: RhoAppApiBuilderContext) {
  return {
    items: api.handler(({ context }) => ({
      items,
      platform: context.host.platform,
    })),
  };
}
```

The router returned from `createRouter` is passed to `createAppExtension` in `src/extension.ts`.

## `src/app.tsx`

`src/app.tsx` is the client app entrypoint. It reads the active route from `useRhoApp()` and renders the matching route component.

```tsx
import { useRhoApp } from "@rho/apps-sdk/react";
import { About } from "./routes/about.tsx";
import { Home } from "./routes/index.tsx";

export default function App() {
  const rho = useRhoApp();

  switch (rho.app.routePath) {
    case "/":
      return <Home />;
    case "/about":
      return <About />;
    default:
      return <main>Route not found: {rho.app.routePath}</main>;
  }
}
```

## `src/client.ts`

`src/client.ts` creates a typed client for the app API.

```ts
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import type { RouterClient } from "@orpc/server";
import type { RhoAppContext } from "@rho/apps-sdk";
import { useRhoApp } from "@rho/apps-sdk/react";
import { useMemo } from "react";
import type { AppRouter } from "./api.ts";

export type ApiClient = RouterClient<AppRouter>;

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

## Route components

Route components are normal React components. They can use `useRhoApp()` for app context and `useApi()` for app API calls.

```tsx
import { useQuery } from "@tanstack/react-query";
import { useRhoApp } from "@rho/apps-sdk/react";
import { useApi } from "../client.ts";

export function Home() {
  const rho = useRhoApp();
  const api = useApi();
  const items = useQuery(api.items.queryOptions());

  return (
    <main>
      <h2>Todo List</h2>
      <p>Running inside rho on {rho.host.platform}.</p>
      <ul>
        {(items.data?.items ?? []).map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </main>
  );
}
```

## `tsconfig.json`

Use bundler module resolution and allow TypeScript extension imports.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["react"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

## Check the extension

Run the package typecheck from the extension directory:

```bash
bun run typecheck
```

Load the extension by passing its directory through `RHO_EXTENSION_PATHS`:

```bash
RHO_EXTENSION_PATHS=./examples/extensions/todo-list bun run --cwd apps/server dev
```

## Next

- [Extension install](extension-install.md)
