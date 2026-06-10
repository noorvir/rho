# Rho Agent

The Rho agent manages Rho runtime changes for the user: building and editing
extensions, installing apps, and working with the shared database.

## Interactive terminal

```bash
rho agent
```

Opens the interactive agent terminal. The terminal wraps the
[pi coding agent](https://github.com/earendil-works/pi-mono) — everything
that works in pi works in Rho out of the box: sessions, slash commands, bash
mode, themes, extensions, and packages. Rho keeps its agent state under
`~/.rho`, separate from any personal pi setup.

## One-shot prompts

```bash
rho agent -p "List the extensions in this runtime"
rho "List the extensions in this runtime"
```

One-shot prompts stream the response to stdout and exit.

## Agent packages

```bash
rho install npm:some-pi-package
rho install git:github.com/user/repo@v1
rho install ./local/extension-or-package
rho remove npm:some-pi-package
```

`rho install` adds extensions, skills, prompt templates, and themes to the
agent. It uses pi's package manager against `~/.rho/agent`, so published pi
packages and pi extensions install and run unmodified.

Rho extension packages can also contribute agent extensions to the runtime —
see [Extensions](extensions.md).

## Providers and models

```bash
rho provider login codex     # subscription login via OAuth
rho model                    # list available models
rho model provider/model-id  # set the default model
```

## Agent state

The agent stores settings, auth, models, and sessions under `~/.rho/agent`.
Set `RHO_AGENT_DIR` to use a different directory.

## Next

- [Runtime filesystem](runtime-filesystem.md)
