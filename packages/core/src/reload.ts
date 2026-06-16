import type { Channel } from "@rho/channels";
import type { AppExtension } from "./apps/index.ts";
import type { CronRegistration } from "./crons.ts";
import type { NotificationDefRegistration } from "./notifications.ts";
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
	replaceCrons(crons: CronRegistration[]): Promise<void>;
	replaceNotificationDefs(defs: NotificationDefRegistration[]): void;
	activeChannelIds(): string[];
}

export type ReloadResult =
	| {
			ok: true;
			channels: string[];
			apps: number;
			crons: number;
			extensions: LoadedExtension[];
			diagnostics: ExtensionDiagnostic[];
	  }
	| {
			ok: false;
			channels: string[];
			apps: number;
			crons: number;
			extensions: LoadedExtension[];
			diagnostics: ExtensionDiagnostic[];
	  };

export async function reload(deps: ReloadDependencies): Promise<ReloadResult> {
	const loaded = await deps.extensionLoader.load();
	const hasErrors = loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error");

	const apps = loaded.extensions.flatMap((extension) => extension.apps);
	const channels = loaded.extensions.flatMap((extension) => extension.channels);
	const agentExtensions = loaded.extensions.flatMap((extension) => extension.agentExtensions);
	const crons = loaded.extensions.flatMap((extension) => extension.crons);
	const notificationDefs = loaded.extensions.flatMap((extension) => extension.notificationDefs);

	if (!hasErrors) {
		deps.replaceApps(apps);
		deps.replaceChannels(channels);
		deps.replaceAgentExtensions(agentExtensions);
		deps.replaceNotificationDefs(notificationDefs);

		await deps.replaceCrons(crons);
	}

	return {
		ok: !hasErrors,
		channels: deps.activeChannelIds(),
		apps: apps.length,
		crons: crons.length,
		extensions: loaded.extensions,
		diagnostics: loaded.diagnostics,
	};
}
