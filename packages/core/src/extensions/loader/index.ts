import type { CronRegistration } from "../../crons.ts";
import type { RhoPrisma } from "../../prisma.ts";
import type {
	ExtensionDiagnostic,
	ExtensionLoader,
	LoadExtensionsResult,
	LoadedExtension,
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
	/** Default user timezone handed to extension definitions. */
	defaultTimezone: string;
}

export class FileSystemExtensionLoader implements ExtensionLoader {
	private readonly paths: ExtensionDiscoveryPaths;
	private readonly db: RhoPrisma;
	private readonly defaultTimezone: string;

	constructor(options: FileSystemExtensionLoaderOptions) {
		this.paths = {
			extensionsDir: options.extensionsDir,
			extensionPaths: options.extensionPaths ?? [],
		};
		this.db = options.db;
		this.defaultTimezone = options.defaultTimezone;
	}

	async load(): Promise<LoadExtensionsResult> {
		const discovered = await discoverExtensions(this.paths);

		const extensions: LoadedExtension[] = [];
		const diagnostics: ExtensionDiagnostic[] = [...discovered.diagnostics];

		for (const extension of discovered.extensions) {
			const crons: CronRegistration[] = [];
			const result = await loadExtensionModule(extension, {
				api: appApiProcedure,
				db: this.db,
				user: { timezone: this.defaultTimezone },
				cron: (input) => {
					crons.push({ ...input, extensionId: extension.source.resolvedPath });
				},
			});
			if ("extension" in result) {
				extensions.push({ ...result.extension, crons });
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
