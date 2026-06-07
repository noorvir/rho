import { access, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DiscoveredExtension, ExtensionSourceOrigin, ExtensionSourceScope } from "../types.ts";
import { readExtensionPackageManifest } from "./package.ts";

export function isExtensionFile(path: string): boolean {
	return path.endsWith(".ts") || path.endsWith(".js");
}

export async function discoverExtensionPath(
	path: string,
	scope: ExtensionSourceScope,
): Promise<DiscoveredExtension[]> {
	const pathStat = await stat(path);

	if (pathStat.isDirectory()) {
		const entries = await extensionEntriesFromDirectory(path, scope, "folder");
		return entries.length > 0 ? entries : discoverExtensionsInDirectory(path, scope);
	}

	return isExtensionFile(path) ? [extensionSource(path, scope, "file", path)] : [];
}

export async function discoverExtensionsInDirectory(
	directory: string,
	scope: ExtensionSourceScope,
): Promise<DiscoveredExtension[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const discovered: DiscoveredExtension[] = [];

	for (const entry of entries) {
		const entryPath = join(directory, entry.name);
		if ((entry.isFile() || entry.isSymbolicLink()) && isExtensionFile(entry.name)) {
			discovered.push(extensionSource(entryPath, scope, "file", entryPath));
			continue;
		}

		if (entry.isDirectory() || entry.isSymbolicLink()) {
			discovered.push(...(await extensionEntriesFromDirectory(entryPath, scope, "folder")));
		}
	}

	return discovered;
}

async function extensionEntriesFromDirectory(
	directory: string,
	scope: ExtensionSourceScope,
	origin: ExtensionSourceOrigin,
): Promise<DiscoveredExtension[]> {
	const manifest = await readExtensionPackageManifest(directory);
	if (manifest) {
		return manifest.extensions.map((entry) =>
			extensionSource(entry, scope, "package", entry, directory),
		);
	}

	for (const fileName of ["index.ts", "index.js"]) {
		const entryPath = join(directory, fileName);
		if (await exists(entryPath)) {
			return [extensionSource(entryPath, scope, origin, entryPath)];
		}
	}

	return [];
}

async function exists(path: string): Promise<boolean> {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

function extensionSource(
	path: string,
	scope: ExtensionSourceScope,
	origin: ExtensionSourceOrigin,
	resolvedPath: string,
	packageRoot?: string,
): DiscoveredExtension {
	return {
		source: {
			path,
			resolvedPath,
			scope,
			origin,
			baseDir: packageRoot ?? dirname(resolvedPath),
			packageRoot,
		},
	};
}
