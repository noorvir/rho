import type { ChannelRuntime, HttpChannel } from "@rho/channels";
import type { ChannelRegistry } from "./channel-registry.ts";

export interface RegistrySource {
	readChannels(): Promise<unknown[]>;
	readApps(): Promise<unknown[]>;
	readSecrets(): Promise<Record<string, string>>;
}

export interface ReloadDependencies {
	runtime: ChannelRuntime;
	channels: ChannelRegistry;
	httpChannel: HttpChannel;
	files: RegistrySource;
}

export interface ReloadResult {
	ok: true;
	channels: string[];
	apps: number;
}

export class EmptyRegistrySource implements RegistrySource {
	async readChannels(): Promise<unknown[]> {
		return [];
	}

	async readApps(): Promise<unknown[]> {
		return [];
	}

	async readSecrets(): Promise<Record<string, string>> {
		return {};
	}
}

export async function reload(deps: ReloadDependencies): Promise<ReloadResult> {
	const [_secrets, _channelDefinitions, apps] = await Promise.all([
		deps.files.readSecrets(),
		deps.files.readChannels(),
		deps.files.readApps(),
	]);

	deps.channels.replace([deps.httpChannel]);
	deps.runtime.replaceChannels(deps.channels.current());

	return {
		ok: true,
		channels: deps.channels.current().map((channel) => channel.id),
		apps: apps.length,
	};
}
