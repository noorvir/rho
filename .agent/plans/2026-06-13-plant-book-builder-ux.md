# Current Work: Plant Book app-builder UX loop

## Goals

Improve Rho's app-building behavior so a normal human prompt produces a mobile-friendly personal app instead of a dense one-screen UI.

The target outcome is a repeatable builder loop where agents naturally choose good app structure:

- a clear list screen
- separate add/edit flow when the form is more than trivial
- detail screens for individual records
- one header per screen
- no generic marketing/filler descriptions
- safe placement for destructive actions
- mobile/WebView-friendly interactions by default

Use a small Plant Book / houseplant tracker as the reference domain because it exercises the patterns that Todo does not: list, add flow, detail, recurring schedule, mark-watered action, and history.

## Non-goals

- Building a full plant-care product with reminders, image recognition, notifications, or external plant databases.
- Redesigning every existing Rho app.
- Adding broad UI framework machinery before repeated failures show which primitives are actually needed.
- Replacing the Todo example entirely; Todo can remain the minimal API/scaffold example, but it should not be the only UX reference.

## Current Direction

Run this as an evaluation loop rather than a single prompt edit.

First create a reference-quality small Plant Book app that demonstrates the desired mobile-first structure. It should be intentionally small but polished enough to serve as a concrete example for future agents.

Then run builder attempts from simple human prompts in disposable runtimes. After each attempt, inspect both the generated app and the agent transcript:

- Did it read the discoverable docs?
- Did it use the scaffold and UI primitives appropriately?
- Did it choose a sane screen architecture before coding?
- Did it avoid duplicate headers and filler descriptions?
- Did it verify the actual UI at a narrow/mobile width?

Iterate in this order:

1. improve docs discoverability and frontmatter/index context
2. adjust rho_context boundaries and docs index
3. add concise app-builder guidance only if discovery is not enough
4. update the background task wrapper only if task agents still skip the relevant docs
5. add higher-level UI primitives only for repeated concrete failure modes

## Success Criteria

- [ ] A small Plant Book reference app exists and demonstrates the desired multi-screen mobile-first app shape.
- [ ] Rho docs are available in installed runtimes and discoverable by path and metadata.
- [ ] A simple prompt like “make me an app to track my houseplants” produces an app with separate list/add/detail flows.
- [ ] Generated apps do not include duplicate page headers or generic filler copy.
- [ ] The builder agent reads or otherwise receives the app-building/UI guidance needed for the task.
- [ ] At least two fresh builder attempts pass the UX checklist without manual correction.

## Tests / Validation

For each builder attempt:

- Use a fresh disposable runtime home.
- Start from a simple human-style prompt, not a detailed implementation spec.
- Capture the task transcript and whether docs/examples were read.
- Inspect the rendered app at phone width.
- Verify list, add, detail, mark-watered, and delete/confirmation behavior.
- Record specific UI failures before changing prompts, docs, or primitives.

## Progress

- [x] Identified current failure mode from Shopping List: dense one-screen layout, duplicate headers, filler description, mobile interaction misses.
- [x] Confirmed recent builder tasks called rho_context but did not read app/UI docs.
- [x] Added frontmatter to docs and made docs packageable for installed runtimes.
- [ ] Build the reference Plant Book app.
- [ ] Add docs index/path metadata to rho_context.
- [ ] Run first baseline builder attempt from a simple plant-tracker prompt.
- [ ] Score the output and decide the smallest next prompt/context/UI primitive change.
