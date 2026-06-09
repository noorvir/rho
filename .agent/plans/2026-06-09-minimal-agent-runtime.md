# Current Work: Minimal Rho Agent Runtime

## Goals

Create a working Rho agent runtime that can be used from code, server/background flows, and a minimal CLI.

The runtime should use Pi's session/resource primitives under the hood while preserving Rho as the product identity. Rho should not reimplement Pi's session management, tool loop, compaction, persistence, model/auth/settings machinery, resource loader, or extension runner unless a Pi public API gap forces a small adapter.

## Non-goals

- Using Pi's native `InteractiveMode` as the Rho CLI.
- Reimplementing Pi's session management, compaction, tool execution, persistence, resource loading, or extension runtime.
- Building the full Rho TUI.
- Implementing every install workflow or database migration flow.
- Implementing the full agent extension model beyond accepting collected agent extension sources.
- Reworking channel, app, or server architecture unrelated to the agent runtime.

## Proposed Shape

Create one canonical factory, conceptually:

```ts
createRhoAgentSession({
  cwd,
  agentDir,
  agentExtensions,
  mode,
})
```

The factory owns the Rho-specific assembly around Pi primitives:

- Construct Pi `createAgentSession` with Rho-owned options.
- Construct Pi `DefaultResourceLoader` with Rho docs, prompt, and agent extension inputs.
- Apply the Rho system prompt and appended prompt rules.
- Provide Rho docs/context guidance.
- Map collected `AgentExtension` sources into Pi resource-loader inputs.
- Adapt Pi session events into a Rho-owned stream shape for callers.

Pi remains responsible for session history, persistence, compaction, model calls, tool selection/execution, resource loading, and extension execution.

## Runtime Identity

The model should identify as the Rho agent. Pi is an implementation layer for sessions, tools, resources, and extension plumbing.

Do not expose Pi native startup copy, changelog copy, update copy, or `InteractiveMode` UI in this runtime. Avoiding Pi product UI does not mean replacing Pi's agent engine; Rho should render its own frontend over Pi sessions.

## First CLI Surface

Add a minimal `rho agent` command over the shared runtime:

1. `rho agent -p "message"` for one-shot print mode.
2. `rho agent` for a simple interactive readline loop.

The CLI should stream assistant text and keep session continuity during a loop. It does not need a rich TUI, slash commands, or complex decision dialogs yet.

## Success Criteria

- [x] A shared Rho agent/session factory exists.
- [x] The factory uses Pi session/resource primitives rather than the low-level `RhoAgent` wrapper as the primary path.
- [x] Session history, compaction, tool execution, persistence, resource loading, and extension execution remain delegated to Pi.
- [x] The Rho system prompt is applied.
- [x] The runtime can accept agent extension path and factory sources when available.
- [x] `rho agent -p "message"` runs a one-shot prompt.
- [x] `rho agent` runs a simple interactive loop.
- [x] The obsolete `CliChannel` implementation was removed after the CLI moved to the shared session runtime.
- [x] No Pi native `InteractiveMode` UI is used.
- [x] User-facing output identifies the assistant as Rho, not Pi.
- [x] Source install/update commands exist through `bun run install:source` and `bun run update:source`, with interactive PATH setup when needed.
- [x] Source install defaults to isolated `~/.rho/source` paths and source settings under `~/.rho/source/agent`.
- [x] `bun run uninstall:source` removes the source launcher, source settings, and source PATH profile block without touching production Rho paths.
- [x] `rho provider login codex` delegates subscription login to Pi auth storage with Rho-facing CLI copy.
- [x] `rho model` lists available Rho models and `rho model provider/model` selects the default model.
- [x] CLI implementation is split by command boundary instead of keeping agent/provider/model flows in one file.

## Tests / Validation

- [x] Typecheck changed packages.
- [x] Run a one-shot prompt locally with a harmless request.
- [x] Run a short interactive loop and verify session startup/exit.
- [x] Verify no Pi startup header, Pi changelog/update notice, or Pi onboarding copy appears in the Rho CLI.
- [x] Verify existing channel/server agent entrypoints still compile or are deliberately migrated to the shared runtime.

## Validation Notes

`rho agent -p "Reply with exactly: Rho"` reached the Rho session prompt path, but the local environment has no configured API key for the selected model. The CLI reported a Rho-facing setup error instead of leaking Pi setup/docs copy.

`printf '/exit\n' | node packages/cli/dist/cli.js agent` verified the readline loop starts and exits with Rho-facing copy only.

`bun run install:source -- --install-dir <temp-dir>` verified source install builds the repo and links `rho` to the CLI build output without touching the default install path. `--add-to-path` was smoke-tested with an isolated fake home directory and wrote the expected guarded shell profile block.

`bun scripts/install-source.ts --source-root <temp-dir> --add-to-path` followed by `bun scripts/uninstall-source.ts --source-root <temp-dir>` verified source install isolation, launcher `RHO_AGENT_DIR` defaulting, PATH block removal, and source settings cleanup.

`rho model` with an isolated `RHO_AGENT_DIR` verified the model command handles the no-models state with Rho-facing copy.
