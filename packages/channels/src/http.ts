import type { Channel, ChannelContext, OutboundMessage, SendReceipt } from "@rho/channels";

export interface SseStream {
	event(name: string, data: Record<string, unknown>): void;
	close(): void;
}

export class HttpChannel implements Channel {
	readonly name = "http";
	readonly kind = "web";
	private readonly streams = new Map<string, SseStream>();

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

	async send(message: OutboundMessage): Promise<SendReceipt> {
		const streamId = readStreamId(message.metadata);
		if (!streamId) {
			return { ok: false, retryable: false, error: "Missing HTTP stream id", raw: null };
		}

		const stream = this.streams.get(streamId);
		if (!stream) {
			return { ok: false, retryable: false, error: `Unknown HTTP stream: ${streamId}`, raw: null };
		}

		stream.event("message.started", { replyTo: message.replyTo });
		stream.event("message.delta", { text: message.text });
		stream.event("message.completed", { text: message.text });
		stream.close();
		this.detach(streamId);

		return { ok: true, messageId: `http:${streamId}`, raw: null };
	}
}

function readStreamId(metadata: Record<string, unknown>): string | undefined {
	const value = metadata.streamId;
	return typeof value === "string" ? value : undefined;
}
