import type { Channel, ChannelMessage, ChannelOutput, SendReceipt } from "./types.ts";

export type ChannelHandler = (message: ChannelMessage) => Promise<ChannelOutput>;

export interface ChannelRuntimeOptions {
	channels: Channel[];
	handle: ChannelHandler;
}

export class ChannelRuntime {
	private readonly abortController = new AbortController();
	private readonly channels = new Map<string, Channel>();
	private readonly handler: ChannelHandler;

	constructor(options: ChannelRuntimeOptions) {
		this.handler = options.handle;
		for (const channel of options.channels) {
			this.channels.set(channel.id, channel);
		}
	}

	async start(): Promise<void> {
		await Promise.all(
			[...this.channels.values()].map((channel) =>
				channel.start({
					receive: async (message) => {
						await this.receive(message);
					},
					signal: this.abortController.signal,
				}),
			),
		);
	}

	async stop(): Promise<void> {
		this.abortController.abort();
		await Promise.all([...this.channels.values()].map((channel) => channel.stop()));
	}

	replaceChannels(channels: Channel[]): void {
		this.channels.clear();
		for (const channel of channels) {
			this.channels.set(channel.id, channel);
		}
	}

	async handle(message: ChannelMessage): Promise<ChannelOutput> {
		return this.handler(message);
	}

	async receive(message: ChannelMessage): Promise<SendReceipt> {
		const channel = this.channels.get(message.channelId);
		if (!channel) {
			throw new Error(`Unknown channel: ${message.channelId}`);
		}

		const output = await this.handle(message);
		return channel.send(output);
	}
}
