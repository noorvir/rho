import { messageText } from "./message.ts";
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

	constructor(
		readonly id = "http",
		private readonly stream: SseStream = new ConsoleSseStream(),
	) {}

	async start(_context: ChannelContext): Promise<void> {}

	async stop(): Promise<void> {
		this.stream.close();
	}

	async send(output: ChannelOutput): Promise<SendReceipt> {
		return isMessageStream(output) ? this.sendStream(output) : this.sendMessage(output);
	}

	private async sendMessage(message: ChannelMessage): Promise<SendReceipt> {
		const text = messageText(message);
		this.stream.event("message.started", { replyTo: message.replyTo });
		this.stream.event("message.delta", { text });
		this.stream.event("message.completed", { text });
		this.stream.close();

		return { ok: true, messageId: message.id, raw: null };
	}

	private async sendStream(messages: AsyncIterable<ChannelMessage>): Promise<SendReceipt> {
		let messageId: string | undefined;
		let text = "";
		let started = false;

		for await (const message of messages) {
			if (!started) {
				this.stream.event("message.started", { replyTo: message.replyTo });
				started = true;
			}

			messageId = message.id;
			const delta = messageText(message);
			text += delta;
			this.stream.event("message.delta", { text: delta });
		}

		if (!messageId) {
			return { ok: false, retryable: false, error: "Missing HTTP message", raw: null };
		}

		this.stream.event("message.completed", { text });
		this.stream.close();

		return { ok: true, messageId, raw: null };
	}
}

class ConsoleSseStream implements SseStream {
	event(name: string, data: Record<string, unknown>): void {
		console.log(`event: ${name}`);
		console.log(`data: ${JSON.stringify(data)}`);
		console.log();
	}

	close(): void {}
}

function isMessageStream(output: ChannelOutput): output is AsyncIterable<ChannelMessage> {
	return Symbol.asyncIterator in output;
}
