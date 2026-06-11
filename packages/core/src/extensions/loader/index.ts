import type { RhoPrisma } from "../../prisma.ts";
import type {
	ExtensionDiagnostic,
	ExtensionLoader,
	LoadExtensionsResult,
	LoadedExtension,
	RhoExtensionContext,
} from "../types.ts";
import { appApiProcedure } from "../types.ts";
import { discoverExtensions, type ExtensionDiscoveryPaths } from "./discover.ts";
import { loadExtensionModule } from "./load.ts";

export type { ExtensionDiscoveryPaths } from "./discover.ts";
export { discoverExtensions } from "./discover.ts";

export interface FileSystemExtensionLoaderOptions {
	/** Absolute directory scanned for project extensions. */
	extensionsDir: string;
	/** Absolute extension entrypoints or directories. */
	extensionPaths?: string[];
	/** Shared runtime database client handed to extension definitions. */
	db: RhoPrisma;
}

export class FileSystemExtensionLoader implements ExtensionLoader {
	private readonly paths: ExtensionDiscoveryPaths;
	private readonly context: RhoExtensionContext;

	constructor(options: FileSystemExtensionLoaderOptions) {
		this.paths = {
			extensionsDir: options.extensionsDir,
			extensionPaths: options.extensionPaths ?? [],
		};
		this.context = { api: appApiProcedure, db: options.db };
	}

	async load(): Promise<LoadExtensionsResult> {
		const discovered = await discoverExtensions(this.paths);

		const extensions: LoadedExtension[] = [];
		const diagnostics: ExtensionDiagnostic[] = [...discovered.diagnostics];

		for (const extension of discovered.extensions) {
			const result = await loadExtensionModule(extension, this.context);
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
