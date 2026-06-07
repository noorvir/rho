import type { Channel } from "@rho/channels";

export type Extension = AppExtension | ChannelExtension;
export type ExtensionType = Extension["type"];

export interface ExtensionBase<TType extends string> {
	type: TType;
	id: string;
	name: string;
}

export interface AppExtension extends ExtensionBase<"app"> {
	slug: string;
	client: AppClient;
	routes: AppRoute[];
	api?: AppApi;
}

export interface AppClient {
	entry: string;
}

export interface AppRoute {
	path: string;
	label?: string;
}

export interface AppApi {
	basePath: string;
	entry: string;
}

export interface ChannelExtension extends ExtensionBase<"channel"> {
	channel: Channel;
}

export interface RhoExtensionApi {
	registerChannel(channel: Channel): void;
}

export type RhoExtension = (rho: RhoExtensionApi) => Promise<void>;

export interface ExtensionLoader {
	load(): Promise<LoadExtensionsResult>;
}

export interface LoadExtensionsResult {
	extensions: LoadedExtension[];
	diagnostics: ExtensionDiagnostic[];
}

export interface LoadedExtension {
	source: ExtensionSourceInfo;
	apps: AppExtension[];
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
