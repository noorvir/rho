---
title: Server
description: The always-on Rho server process, runtime configuration, extension reloads, and state paths.
tags:
  - server
  - runtime
  - configuration
  - reload
---

# Server

The Rho server is one always-on process. It serves the web app, the HTTP API,
channel conversations, installed apps, and the shared database.

## Running

```bash
bun run --cwd apps/server dev    # development server with web hot reload
bun run --cwd apps/server start  # production server (built assets)
```

The server listens on `RHO_PORT` (default 7331).

## Runtime configuration

| Variable | Purpose |
|----------|---------|
| `RHO_PORT` | HTTP port. |
| `RHO_DATABASE_URL` | Shared SQLite database, for example `file:./db/rho.sqlite`. |
| `RHO_AGENT_DIR` | Agent config directory (auth, settings, models, sessions). Default `~/.rho/agent`. |
| `RHO_STATE_DIR` | Conversation and task state directory. Default `<agent dir>/rho-state`. |
| `RHO_EXTENSION_PATHS` | Colon-separated extra extension paths to load. |
| `RHO_OWNER_TOKEN` | Owner token for first-time auth setup. |

## Applying extension changes

After creating or editing an extension, the runtime must reload for the
change to become visible in the web and mobile apps. From an agent session,
call the `rho_reload` tool. Over HTTP, authenticated clients can
`POST /reload`. A reload rediscovers extensions, reloads their modules, and
replaces the registered apps and channels atomically; the server keeps
running.

Database schema changes are separate from reload: they follow the Rho-managed
migration flow described in [Database](database.md), and happen before the
reload that exposes the app using them.

## State on disk

- Agent config and sessions: `RHO_AGENT_DIR`
- Conversation and task state: `RHO_STATE_DIR`
- Shared database: the `RHO_DATABASE_URL` file under the runtime's `db/`

## Next

- [Apps](apps.md)
