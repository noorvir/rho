import { tc, wrapError } from "@rho/lib";
import type { DiscoveredExtension, ExtensionDiagnostic } from "../types.ts";
import { discoverExtensionPath, discoverExtensionsInDirectory } from "./entrypoints.ts";

export interface ExtensionDiscoveryPaths {
	extensionsDir: string;
	extensionPaths: string[];
}

export interface DiscoverExtensionsResult {
	extensions: DiscoveredExtension[];
	diagnostics: ExtensionDiagnostic[];
}

export async function discoverExtensions(args: ExtensionDiscoveryPaths): Promise<DiscoverExtensionsResult> {
	const dir = args.extensionsDir;
	const paths = args.extensionPaths;

	const projExtensions = await discoverProjectExtensions(dir);
	const pathExtensions = await discoverConfiguredExtensions(paths);

	return {
		extensions: dedupe([...projExtensions.extensions, ...pathExtensions.extensions]),
		diagnostics: [...projExtensions.diagnostics, ...pathExtensions.diagnostics],
	};
}

async function discoverProjectExtensions(extensionsDir: string): Promise<DiscoverExtensionsResult> {
	const result = await tc(discoverExtensionsInDirectory(extensionsDir, "project"));
	if (!result.error) {
		return { extensions: result.data, diagnostics: [] };
	}
	if (errorCode(result.error) === "ENOENT") {
		return { extensions: [], diagnostics: [] };
	}

	return {
		extensions: [],
		diagnostics: [
			{
				path: extensionsDir,
				severity: "error",
				message: wrapError(result.error, "Failed to discover project extensions").message,
			},
		],
	};
}

async function discoverConfiguredExtensions(paths: string[]): Promise<DiscoverExtensionsResult> {
	const discover = async (path: string) => {
		const result = await tc(discoverExtensionPath(path, "configured"));
		if (!result.error) {
			return { extensions: result.data, diagnostics: [] };
		}

		return {
			extensions: [],
			diagnostics: [
				{
					path,
					severity: "error" as const,
					message: wrapError(result.error, "Failed to discover configured extension").message,
				},
			],
		};
	};

	const res = await Promise.all(paths.map(discover));
	return {
		extensions: res.flatMap((r) => r.extensions),
		diagnostics: res.flatMap((r) => r.diagnostics),
	};
}

function dedupe(extensions: DiscoveredExtension[]): DiscoveredExtension[] {
	const seen = new Set<string>();
	const unique: DiscoveredExtension[] = [];

	for (const extension of extensions) {
		if (seen.has(extension.source.resolvedPath)) {
			continue;
		}
		seen.add(extension.source.resolvedPath);
		unique.push(extension);
	}

	return unique;
}

function errorCode(error: Error): string | undefined {
	return typeof error === "object" && "code" in error && typeof error.code === "string"
		? error.code
		: undefined;
}
