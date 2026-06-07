import type { Channel } from "@rho/channels";
import type { ExtensionDiagnostic, ExtensionLoader, LoadedExtension } from "./extensions/index.ts";

export interface RegistrySource {
	readApps(): Promise<unknown[]>;
	readSecrets(): Promise<Record<string, string>>;
}

export interface ReloadDependencies {
	extensionLoader: ExtensionLoader;
	replaceChannels(channels: Channel[]): void;
	activeChannelIds(): string[];
	files: RegistrySource;
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

export class EmptyRegistrySource implements RegistrySource {
	async readApps(): Promise<unknown[]> {
		return [];
	}

	async readSecrets(): Promise<Record<string, string>> {
		return {};
	}
}

export async function reload(deps: ReloadDependencies): Promise<ReloadResult> {
	const [_secrets, apps, loaded] = await Promise.all([
		deps.files.readSecrets(),
		deps.files.readApps(),
		deps.extensionLoader.load(),
	]);
	const hasErrors = loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error");

	if (!hasErrors) {
		deps.replaceChannels(loaded.channels);
	}

	return {
		ok: !hasErrors,
		channels: deps.activeChannelIds(),
		apps: apps.length,
		extensions: loaded.extensions,
		diagnostics: loaded.diagnostics,
	};
}
