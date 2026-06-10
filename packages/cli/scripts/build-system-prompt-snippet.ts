#!/usr/bin/env bun
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
copyFileSync(join(packageDir, "dist", "system-prompt-snippet.js"), join(packageDir, "dist", "system:prompt-snippet"));
