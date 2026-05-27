import type {
	Channel,
	ChannelContext,
	ChannelMessage,
	ChannelOutput,
	SendReceipt,
} from "./types.ts";

export interface SseStream {
	event(name: string, data: Record<string, unknown>): void;
	close(): void;
}

export class HttpChannel implements Channel {
	readonly kind = "http";
	private readonly streams = new Map<string, SseStream>();

	constructor(readonly id = "http") {}

	attach(streamId: string, stream: SseStream): void {
		this.streams.set(streamId, stream);
	}

	detach(streamId: string): void {
		this.streams.delete(streamId);
	}

	async start(_context: ChannelContext): Promise<void> {}

	async stop(): Promise<void> {
		for (const stream of this.streams.values()) {
			stream.close();
		}
		this.streams.clear();
	}

	async send(output: ChannelOutput): Promise<SendReceipt> {
		let receipt: SendReceipt | undefined;
		for await (const message of messagesFrom(output)) {
			receipt = await this.sendMessage(message);
			if (!receipt.ok) return receipt;
		}

		return receipt ?? { ok: false, retryable: false, error: "Missing HTTP message", raw: null };
	}

	private async sendMessage(message: ChannelMessage): Promise<SendReceipt> {
		if (!message.streamId) {
			return { ok: false, retryable: false, error: "Missing HTTP stream id", raw: null };
		}

		const stream = this.streams.get(message.streamId);
		if (!stream) {
			return {
				ok: false,
				retryable: false,
				error: `Unknown HTTP stream: ${message.streamId}`,
				raw: null,
			};
		}

		const text = messageText(message);
		stream.event("message.started", { replyTo: message.replyTo });
		stream.event("message.delta", { text });
		stream.event("message.completed", { text });
		stream.close();
		this.detach(message.streamId);

		return { ok: true, messageId: message.id, raw: null };
	}
}

function messageText(message: ChannelMessage): string {
	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

async function* messagesFrom(output: ChannelOutput): AsyncIterable<ChannelMessage> {
	if (Symbol.asyncIterator in output) {
		yield* output;
		return;
	}

	yield output;
}
