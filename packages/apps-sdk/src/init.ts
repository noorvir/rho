#!/usr/bin/env bun

import { cp, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const appName = process.argv[2];
const targetArg = process.argv[3];

if (!appName) {
	console.error("usage: create-rho-app-extension <name> [target-dir]");
	process.exit(1);
}

const slug = slugify(appName);
if (!slug) {
	console.error("extension name must contain at least one letter or number");
	process.exit(1);
}

const name = titleize(slug);
const templateDir = new URL("../template/app-extension/", import.meta.url).pathname;
const targetDir = resolve(targetArg ?? join("examples/extensions", slug));

await mkdir(targetDir, { recursive: true });
await cp(templateDir, targetDir, { recursive: true, errorOnExist: false });
await replaceTemplateTokens(targetDir, {
	__APP_SLUG__: slug,
	__APP_NAME__: name,
	__PACKAGE_NAME__: packageName(slug),
});

console.log(`created ${name} at ${targetDir}`);

async function replaceTemplateTokens(directory: string, replacements: Record<string, string>): Promise<void> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			await replaceTemplateTokens(path, replacements);
			continue;
		}

		const content = await readFile(path, "utf8");
		let nextContent = content;
		for (const [token, replacement] of Object.entries(replacements)) {
			nextContent = nextContent.replaceAll(token, replacement);
		}
		if (nextContent !== content) {
			await writeFile(path, nextContent);
		}
		if (path.endsWith(".template")) {
			await rename(path, path.slice(0, -".template".length));
		}
	}
}

function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "");
}

function titleize(slug: string): string {
	return slug
		.split("-")
		.filter(Boolean)
		.map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
		.join(" ");
}

function packageName(slug: string): string {
	return `rho-app-${basename(slug)}`;
}
