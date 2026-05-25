import type { Channel } from "@rho/channels";

export class ChannelRegistry {
	private channels: Channel[] = [];

	constructor(channels: Channel[] = []) {
		this.replace(channels);
	}

	current(): Channel[] {
		return [...this.channels];
	}

	replace(channels: Channel[]): void {
		this.channels = [...channels];
	}
}
