---
title: Extension Install
description: How Rho tries, installs, updates, removes, and explains extension installation choices.
tags:
  - extensions
  - install
  - packages
---

# Extension Install

Extension installation is managed by the Rho agent.

Installation adds an extension to the user's Rho runtime. Trying an extension runs it separately first.

## Try

Trying an extension runs it in standalone mode.

Try mode uses extension-local files and extension-local data. It must not change the user's shared database, runtime schema, or installed extensions.

Use try mode for previews, demos, tests, and development.

## Install

Installing an extension adds it to the user's Rho runtime.

During install, the Rho agent:

1. Reads the extension package.
2. Loads the Rho entrypoint declared by the package.
3. Reads any database requirements declared by the extension.
4. Reads the runtime schema from `db/schema.prisma`.
5. Compares the extension requirements with the runtime schema.
6. Reuses compatible existing data when possible.
7. Adds missing data structures when the change is safe and additive.
8. Asks the user when a decision affects existing data.
9. Writes the approved schema to `db/schema.prisma`.
10. Creates and runs a Prisma migration against `db/rho.sqlite`.
11. Regenerates `db/generated/`.
12. Installs the extension into the runtime.

Extension code does not perform these install-time database changes itself. Rho performs them as host operations.

## User decisions

When installation needs a decision, the Rho agent should ask in product terms instead of schema terms.

For example, if the user already has todo data and the Todo app can reuse it, ask:

```txt
You already have a todo list in Rho.

I can connect this app to your existing todos, or keep it separate with its own list.

Recommended: use your existing todos so everything stays together.

[Use existing todos] [Keep separate] [Cancel]
```

Do not ask normal users questions like:

```txt
Map TodoItem.title to todos.name?
```

The default path should include a recommendation. Technical details and field-level mapping belong behind a customization path, not in the first prompt.

## Data safety

Rho preserves existing data by default.

If installing an extension requires deleting, replacing, or rewriting existing data, Rho must ask the user before applying that change.

## Next

- [Rho Agent](agent.md)
