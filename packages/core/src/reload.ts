import type { Channel } from "@rho/channels";
import type { AppExtension } from "./apps/index.ts";
import type {
	AgentExtension,
	ExtensionDiagnostic,
	ExtensionLoader,
	LoadedExtension,
} from "./extensions/index.ts";

export interface ReloadDependencies {
	extensionLoader: ExtensionLoader;
	replaceApps(apps: AppExtension[]): void;
	replaceChannels(channels: Channel[]): void;
	replaceAgentExtensions(agentExtensions: AgentExtension[]): void;
	activeChannelIds(): string[];
}

export type ReloadResult =
	| {
			ok: true;
			channels: string[];
			apps: number;
			extensions: LoadedExtension[];
			diagnostics: ExtensionDiagnostic[];
	  }
	| {
			ok: false;
			channels: string[];
			apps: number;
			extensions: LoadedExtension[];
			diagnostics: ExtensionDiagnostic[];
	  };

export async function reload(deps: ReloadDependencies): Promise<ReloadResult> {
	const loaded = await deps.extensionLoader.load();
	const hasErrors = loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error");

	const apps = loaded.extensions.flatMap((extension) => extension.apps);
	const channels = loaded.extensions.flatMap((extension) => extension.channels);
	const agentExtensions = loaded.extensions.flatMap((extension) => extension.agentExtensions);

	if (!hasErrors) {
		deps.replaceApps(apps);
		deps.replaceChannels(channels);
		deps.replaceAgentExtensions(agentExtensions);
	}

	return {
		ok: !hasErrors,
		channels: deps.activeChannelIds(),
		apps: apps.length,
		extensions: loaded.extensions,
		diagnostics: loaded.diagnostics,
	};
}
