import type { Channel } from "@rho/channels";

export interface RhoExtensionApi {
	registerChannel(channel: Channel): void;
}

export type RhoExtension = (rho: RhoExtensionApi) => Promise<void>;

export interface ExtensionLoader {
	load(): Promise<LoadExtensionsResult>;
}

export interface LoadExtensionsResult {
	extensions: LoadedExtension[];
	channels: Channel[];
	diagnostics: ExtensionDiagnostic[];
}

export interface LoadedExtension {
	source: ExtensionSourceInfo;
	channels: Channel[];
}

export interface DiscoveredExtension {
	source: ExtensionSourceInfo;
}

export interface ExtensionSourceInfo {
	path: string;
	resolvedPath: string;
	scope: ExtensionSourceScope;
	origin: ExtensionSourceOrigin;
	baseDir: string;
	packageRoot?: string;
}

export interface ExtensionDiagnostic {
	path: string;
	severity: ExtensionDiagnosticSeverity;
	message: string;
}

export type ExtensionSourceScope = "project" | "configured";
export type ExtensionSourceOrigin = "file" | "folder" | "package";
export type ExtensionDiagnosticSeverity = "error" | "warning";
