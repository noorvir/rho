# Current Work: Single persistent app WebView + client-side navigation

## Goal

Make switching between apps in the mobile shell fast by stopping the
tear-down-and-reload-per-app behavior.

Today each app opens `/embed/apps/<slug>` in a fresh `WKWebView`, and the web
view is destroyed when you leave the app. Returning rebuilds the web view and
does a full document load (new process, re-parse shell, re-import bundle,
re-mount, re-fetch). That full reload is the perceived slowness.

## Approach (this work)

One persistent `WKWebView` for the whole session, plus client-side navigation:

- Native holds a single web view (`WebAppHost`) alive across screen changes.
- First app open does one real document load of `/embed/apps/<slug>`.
- Every later app switch calls a JS hook in the embed to client-navigate
  (`window.__rhoNavigate('/embed/apps/<slug>')`) instead of loading a new URL.
- The embed (`rho-apps.tsx`) defines `__rhoNavigate` (calls the router's
  navigate) and posts a `ready` message so native knows the hook exists; native
  queues a navigation if it is requested before ready.

Benefits: one WebContent process (low memory), warm shell (router, React Query),
and the JS module cache means re-visiting an app does not re-download/re-parse
its bundle.

### Bridge shape

- Web -> Native: `WKScriptMessageHandler` named `rho`; the embed posts
  `{ type: "ready" }` once mounted.
- Native -> Web: `webView.evaluateJavaScript("window.__rhoNavigate('<path>')")`.

`__rhoNavigate` takes a full path, so it can target a specific page inside an
app, not just the app root.

### Known tradeoff accepted for now

Switching apps unmounts the previous app's component tree, so returning re-runs
its data fetches (fast — bundle is cached — but not instant-with-data).
Pull-to-refresh still does a full `reloadFromOrigin` of the current app.

## Future (not now)

- Keep visited apps mounted-but-hidden in the embed so returning is instant with
  warm data; optionally pre-mount/pre-warm apps in the background. Decide after
  trying the single-webview version.
- Agent-driven navigation: a `rho_app_navigate({ slug, path })` tool plus a
  transport that pushes the action to the live mobile client (overlaps with the
  realtime/notifications channel), which then calls the same `__rhoNavigate`
  primitive.
- Lighter pull-to-refresh that refetches app data without a full document
  reload.
