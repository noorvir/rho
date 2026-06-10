import { type AnyRouter, os } from "@orpc/server";
import type { RhoAgentExtensionSource } from "@rho/ai";
import type { Channel } from "@rho/channels";

export type { RhoAgentExtensionSource } from "@rho/ai";

export type Extension = AppExtension | ChannelExtension | AgentExtension;
export type ExtensionType = Extension["type"];
export type RhoHostPlatform = "web" | "mobile" | "desktop";

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
	router: AnyRouter;
}

export interface ChannelExtension extends ExtensionBase<"channel"> {
	channel: Channel;
}

export interface AgentExtension extends ExtensionBase<"agent"> {
	sources: RhoAgentExtensionSource[];
}

export interface RhoAppApiContext {
	app: {
		slug: string;
		name: string;
		basePath: string;
		apiBasePath: string;
	};
	host: {
		platform: RhoHostPlatform;
	};
}

export const appApiProcedure = os.$context<RhoAppApiContext>();

export interface RhoAppApiBuilderContext {
	api: typeof appApiProcedure;
}

export interface RhoExtensionContext extends RhoAppApiBuilderContext {}

export interface RhoExtensionDefinition {
	apps?: AppExtension[];
	channels?: Channel[];
	agentExtensions?: AgentExtension[];
}

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
	agentExtensions: AgentExtension[];
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
