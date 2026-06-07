import type { Channel } from "@rho/channels";
import type { RhoExtensionApi } from "./types.ts";

export class ExtensionCollector implements RhoExtensionApi {
	private readonly registeredChannels: Channel[] = [];

	registerChannel(channel: Channel): void {
		assertChannel(channel);
		this.registeredChannels.push(channel);
	}

	channels(): Channel[] {
		return [...this.registeredChannels];
	}
}

function assertChannel(value: unknown): asserts value is Channel {
	const channel = readRecord(value);
	if (!channel) {
		throw new Error("registerChannel expected a channel object");
	}
	if (typeof channel.id !== "string" || channel.id.trim() === "") {
		throw new Error("registerChannel expected channel.id to be a non-empty string");
	}
	if (typeof channel.kind !== "string" || channel.kind.trim() === "") {
		throw new Error("registerChannel expected channel.kind to be a non-empty string");
	}
	if (typeof channel.start !== "function") {
		throw new Error(`registerChannel expected ${channel.id}.start to be a function`);
	}
	if (typeof channel.stop !== "function") {
		throw new Error(`registerChannel expected ${channel.id}.stop to be a function`);
	}
	if (typeof channel.send !== "function") {
		throw new Error(`registerChannel expected ${channel.id}.send to be a function`);
	}
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}
