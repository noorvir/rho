# rho

A lightweight substrate for long-running AI agents, inspired by pi.

Rho is an agent-managed runtime for personal apps and extensions. It uses trusted source-code extensions and a shared SQLite database that the Rho agent helps manage.

## Documentation

Start with [docs/index.md](docs/index.md).

The docs use a simple Todo app as the running app-extension example.

Key docs:

- [Rho Agent](docs/agent.md) — native agent behavior and docs-reading rules.
- [Runtime filesystem](docs/runtime-filesystem.md) — runtime root, stable paths, generated files, and extension locations.
- [Database](docs/database.md) — shared SQLite, canonical Prisma schema, generated client, and migrations.
- [Extensions](docs/extensions.md) — extension package shape, standalone mode, installed mode, and trust model.
- [Extension structure](docs/extension-schema.md) — package files and manual extension creation steps.
- [Extension install](docs/extension-install.md) — try/install/update/remove flows and user-friendly conflict handling.

## Packages

- `@rho/channels` — channel primitives for long-running agents.
- `@rho/ai` — AI provider integration layer.
- `@rho/cli` — command-line interface.

## Development

```bash
bun install
bun run build
bun run check
```
