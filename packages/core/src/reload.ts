import type { Channel } from "@rho/channels";
import type { ExtensionDiagnostic, ExtensionLoader, LoadedExtension } from "./extensions/index.ts";

export interface ReloadDependencies {
	extensionLoader: ExtensionLoader;
	replaceChannels(channels: Channel[]): void;
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

	if (!hasErrors) {
		deps.replaceChannels(channels);
	}

	return {
		ok: !hasErrors,
		channels: deps.activeChannelIds(),
		apps: apps.length,
		extensions: loaded.extensions,
		diagnostics: loaded.diagnostics,
	};
}
