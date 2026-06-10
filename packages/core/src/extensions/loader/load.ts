import { dirname, resolve } from "node:path";
import { tc, wrapError } from "@rho/lib";
import { createJiti } from "jiti";
import type {
	AgentExtension,
	AppExtension,
	DiscoveredExtension,
	ExtensionDiagnostic,
	LoadedExtension,
	RhoExtensionContext,
	RhoExtensionDefinition,
} from "../types.ts";
import { appApiProcedure } from "../types.ts";

const jiti = createJiti(import.meta.url, { moduleCache: false });

type LoadExtensionModuleResult = { extension: LoadedExtension } | { diagnostics: ExtensionDiagnostic[] };

type ExtensionDefinitionFn = (context: RhoExtensionContext) => Promise<RhoExtensionDefinition>;

export async function loadExtensionModule(
	discovered: DiscoveredExtension,
): Promise<LoadExtensionModuleResult> {
	const imported = await tc(jiti.import(discovered.source.resolvedPath, { default: true }));
	if (imported.error) {
		return failure(discovered, wrapError(imported.error, "Failed to import extension"));
	}

	if (!isExtensionDefinitionFn(imported.data)) {
		return failure(discovered, new Error("Extension must default-export an extension definition function"));
	}

	const define = imported.data;

	const definitionRes = await tc(async () => define({ api: appApiProcedure }));
	if (definitionRes.error) {
		return failure(discovered, wrapError(definitionRes.error, "Failed to define extension"));
	}

	const definition = definitionRes.data;

	const apps = definition.apps ?? [];
	const channels = definition.channels ?? [];
	const agentExtensions = definition.agentExtensions ?? [];
	const baseDir = dirname(discovered.source.resolvedPath);

	return {
		extension: {
			source: discovered.source,
			apps: apps.map((app) => normalizeAppExtension(app, baseDir)),
			channels,
			agentExtensions: agentExtensions.map((agent) => normalizeAgentExtension(agent, baseDir)),
		},
	};
}

function normalizeAppExtension(extension: AppExtension, baseDir: string): AppExtension {
	return {
		...extension,
		client: {
			entry: resolve(baseDir, extension.client.entry),
		},
		api: extension.api
			? {
					basePath: extension.api.basePath,
					router: extension.api.router,
				}
			: undefined,
	};
}

function normalizeAgentExtension(extension: AgentExtension, baseDir: string): AgentExtension {
	const sources = extension.sources.map((source) => {
		if (source.type === "path") {
			return { ...source, path: resolve(baseDir, source.path) };
		}
		return source;
	});

	return { ...extension, sources };
}

function isExtensionDefinitionFn(value: unknown): value is ExtensionDefinitionFn {
	return typeof value === "function";
}

function failure(extension: DiscoveredExtension, error: Error): LoadExtensionModuleResult {
	return {
		diagnostics: [
			{
				path: extension.source.path,
				severity: "error",
				message: error.message,
			},
		],
	};
}
