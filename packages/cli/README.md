# @rho/cli

Command-line interface for rho.

```bash
rho agent                    # interactive agent terminal
rho agent -p "message"       # one-shot prompt
rho "message"                # one-shot prompt
rho provider login codex     # subscription login via OAuth
rho model                    # list models / set default
```

## The agent terminal

The rho terminal wraps the [pi coding agent](https://github.com/earendil-works/pi-mono). Everything that works in pi works
in rho out of the box. The build step (`scripts/repack-tui.ts`) vendors pi's
published `dist/` into `tui/` with a generated manifest using pi's fork
mechanism (`piConfig: { name: "rho", configDir: ".rho" }`), so the terminal
presents as `rho` and keeps its state under `~/.rho`. Pi's README ships
alongside as `tui/PI-README.md`.

Updating pi means bumping the `@earendil-works/pi-coding-agent` dependency and
rebuilding. This package mirrors pi's runtime dependencies because declared
dependencies are the only resolution every package manager guarantees for
files inside a published package; the repack fails if a pi bump changes the
list.
