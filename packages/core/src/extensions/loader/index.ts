import { resolve } from "node:path";
import type {
	ExtensionDiagnostic,
	ExtensionLoader,
	LoadExtensionsResult,
	LoadedExtension,
} from "../types.ts";
import { discoverExtensions, type ExtensionDiscoveryPaths } from "./discover.ts";
import { loadExtensionModule } from "./load.ts";

export type { ExtensionDiscoveryPaths } from "./discover.ts";
export { discoverExtensions } from "./discover.ts";

export interface FileSystemExtensionLoaderOptions {
	cwd?: string;
	extensionPaths?: string[];
	projectExtensionsDir?: string;
}

export class FileSystemExtensionLoader implements ExtensionLoader {
	private readonly paths: ExtensionDiscoveryPaths;

	constructor(options: FileSystemExtensionLoaderOptions = {}) {
		this.paths = resolveAbsolutePaths(options);
	}

	async load(): Promise<LoadExtensionsResult> {
		const discovered = await discoverExtensions(this.paths);

		const extensions: LoadedExtension[] = [];
		const diagnostics: ExtensionDiagnostic[] = [...discovered.diagnostics];

		for (const extension of discovered.extensions) {
			const result = await loadExtensionModule(extension);
			if ("extension" in result) {
				extensions.push(result.extension);
				continue;
			}
			diagnostics.push(...result.diagnostics);
		}

		return {
			extensions,
			diagnostics,
		};
	}
}

function resolveAbsolutePaths(options: FileSystemExtensionLoaderOptions): ExtensionDiscoveryPaths {
	const cwd = resolve(options.cwd ?? process.cwd());
	return {
		extensionsDir: resolve(cwd, options.projectExtensionsDir ?? ".rho/extensions"),
		extensionPaths: (options.extensionPaths ?? []).map((path) => resolve(cwd, path)),
	};
}
