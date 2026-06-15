#!/usr/bin/env bun

import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(serverDir, "..", "..");
const docsSource = join(repoRoot, "docs");
const docsTarget = join(serverDir, "dist", "docs");

rmSync(docsTarget, { recursive: true, force: true });
mkdirSync(dirname(docsTarget), { recursive: true });
cpSync(docsSource, docsTarget, { recursive: true });
