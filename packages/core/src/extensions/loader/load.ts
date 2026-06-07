import { dirname, resolve } from "node:path";
import { tc, wrapError } from "@rho/lib";
import { createJiti } from "jiti";
import type {
	AppApi,
	AppClient,
	AppExtension,
	AppRoute,
	DiscoveredExtension,
	Extension,
	ExtensionDiagnostic,
	LoadedExtension,
} from "../types.ts";

const jiti = createJiti(import.meta.url, { moduleCache: false });

type LoadExtensionModuleResult = { extension: LoadedExtension } | { diagnostics: ExtensionDiagnostic[] };

export async function loadExtensionModule(
	extension: DiscoveredExtension,
): Promise<LoadExtensionModuleResult> {
	const imported = await tc(jiti.import(extension.source.resolvedPath, { default: true }));
	if (imported.error) {
		return failure(extension, wrapError(imported.error, "Failed to import extension"));
	}

	if (!isExtension(imported.data)) {
		return failure(extension, new Error("Extension must default-export an extension object"));
	}

	return {
		extension: loadedExtension(extension, imported.data),
	};
}

function loadedExtension(discovered: DiscoveredExtension, extension: Extension): LoadedExtension {
	if (extension.type === "app") {
		return {
			source: discovered.source,
			apps: [normalizeAppExtension(extension, dirname(discovered.source.resolvedPath))],
			channels: [],
		};
	}

	return {
		source: discovered.source,
		apps: [],
		channels: [extension.channel],
	};
}

function normalizeAppExtension(extension: AppExtension, baseDir: string): AppExtension {
	return {
		...extension,
		client: {
			entry: resolve(baseDir, extension.client.entry),
		},
		routes: extension.routes,
		api: extension.api
			? {
					...extension.api,
					entry: resolve(baseDir, extension.api.entry),
				}
			: undefined,
	};
}

function isExtension(value: unknown): value is Extension {
	return isAppExtension(value) || isChannelExtension(value);
}

function isAppExtension(value: unknown): value is AppExtension {
	const app = readRecord(value);
	return Boolean(
		app &&
			app.type === "app" &&
			isNonEmptyString(app.id) &&
			isNonEmptyString(app.slug) &&
			isNonEmptyString(app.name) &&
			isAppClient(app.client) &&
			Array.isArray(app.routes) &&
			app.routes.every(isAppRoute) &&
			(app.api === undefined || isAppApi(app.api)),
	);
}

function isChannelExtension(value: unknown): value is Extract<Extension, { type: "channel" }> {
	const extension = readRecord(value);
	return Boolean(
		extension &&
			extension.type === "channel" &&
			isNonEmptyString(extension.id) &&
			isNonEmptyString(extension.name) &&
			isChannel(extension.channel),
	);
}

function isAppClient(value: unknown): value is AppClient {
	const client = readRecord(value);
	return Boolean(client && isNonEmptyString(client.entry));
}

function isAppRoute(value: unknown): value is AppRoute {
	const route = readRecord(value);
	return Boolean(
		route && isNonEmptyString(route.path) && (route.label === undefined || typeof route.label === "string"),
	);
}

function isAppApi(value: unknown): value is AppApi {
	const api = readRecord(value);
	return Boolean(api && isNonEmptyString(api.basePath) && isNonEmptyString(api.entry));
}

function isChannel(value: unknown): value is Extract<Extension, { type: "channel" }>["channel"] {
	const channel = readRecord(value);
	return Boolean(
		channel &&
			isNonEmptyString(channel.id) &&
			isNonEmptyString(channel.kind) &&
			typeof channel.start === "function" &&
			typeof channel.stop === "function" &&
			typeof channel.send === "function",
	);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim() !== "";
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
	return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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
