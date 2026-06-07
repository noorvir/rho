import { type Result, tc, wrapError } from "@rho/lib";
import { createJiti } from "jiti";
import { ExtensionCollector } from "../collector.ts";
import type {
	DiscoveredExtension,
	ExtensionDiagnostic,
	LoadedExtension,
	RhoExtension,
} from "../types.ts";

const jiti = createJiti(import.meta.url, { moduleCache: false });

type LoadExtensionModuleResult =
	| { extension: LoadedExtension }
	| { diagnostics: ExtensionDiagnostic[] };

export async function loadExtensionModule(
	extension: DiscoveredExtension,
): Promise<LoadExtensionModuleResult> {
	const imported = await tc(jiti.import(extension.source.resolvedPath, { default: true }));
	if (imported.error) {
		return failure(extension, wrapError(imported.error, "Failed to import extension"));
	}

	const loadedExtension = getExtension(imported.data);
	if (loadedExtension.error) {
		return failure(extension, loadedExtension.error);
	}

	const collector = new ExtensionCollector();
	const initialized = await tc(() => loadedExtension.data(collector));
	if (initialized.error) {
		return failure(extension, wrapError(initialized.error, "Failed to initialize extension"));
	}

	return {
		extension: {
			source: extension.source,
			channels: collector.channels(),
		},
	};
}

function getExtension(value: unknown): Result<RhoExtension> {
	if (!isExtension(value)) {
		return { data: null, error: new Error("Extension must default-export an async function") };
	}

	return { data: value, error: null };
}

function isExtension(value: unknown): value is RhoExtension {
	return typeof value === "function" && !isClass(value);
}

function isClass(value: unknown): boolean {
	return Function.prototype.toString.call(value).startsWith("class");
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
