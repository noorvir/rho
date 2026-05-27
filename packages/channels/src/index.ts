import type {
	Channel,
	ChannelContent,
	ChannelMessage,
	ChannelOutput,
	ChannelTarget,
	MessageId,
	SendReceipt,
} from "./types.ts";

export { CliChannel } from "./cli.ts";
export { HttpChannel, type SseStream } from "./http.ts";

export type {
	Attachment,
	AttachmentBase,
	AudioContent,
	Channel,
	ChannelContent,
	ChannelContext,
	ChannelId,
	ChannelKind,
	ChannelMediaRef,
	ChannelMessage,
	ChannelMessageStream,
	ChannelOutput,
	ChannelParticipant,
	ChannelTarget,
	ConversationId,
	ConversationTarget,
	DataAttachment,
	DataMediaRef,
	FileAttachment,
	FileContent,
	FileMediaRef,
	ImageContent,
	MediaRef,
	MediaRefBase,
	MessageId,
	RealtimeChannel,
	RealtimeContent,
	RealtimeFrame,
	RealtimeFrameStream,
	RealtimeSession,
	RealtimeSessionId,
	RealtimeSessionRequest,
	SendReceipt,
	TextContent,
	ThreadTarget,
	UrlAttachment,
	UrlMediaRef,
	VideoContent,
} from "./types.ts";

export type ChannelHandler = (message: ChannelMessage) => Promise<ChannelOutput>;

export interface ChannelRuntimeOptions {
	channels: Channel[];
	handle: ChannelHandler;
}

export class ChannelRuntime {
	private readonly abortController = new AbortController();
	private readonly channels = new Map<string, Channel>();
	private readonly handle: ChannelHandler;

	constructor(options: ChannelRuntimeOptions) {
		this.handle = options.handle;
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

	async receive(message: ChannelMessage): Promise<SendReceipt> {
		const channel = this.channels.get(message.channelId);
		if (!channel) {
			throw new Error(`Unknown channel: ${message.channelId}`);
		}

		return channel.send(await this.handle(message));
	}
}

export interface ChannelMessageOptions {
	id?: MessageId;
	channelId?: string;
	target?: ChannelTarget;
	from?: ChannelMessage["from"];
	timestamp?: Date;
	attachments?: ChannelMessage["attachments"];
	metadata?: ChannelMessage["metadata"];
	raw?: unknown | null;
}

export function channelMessage(
	content: string | ChannelContent[],
	options: ChannelMessageOptions = {},
): ChannelMessage {
	return {
		id: options.id ?? `msg:${crypto.randomUUID()}`,
		channelId: options.channelId ?? "cli",
		target: options.target ?? { type: "conversation", id: "cli" },
		from: options.from ?? { id: "cli-user", role: "user" },
		content: typeof content === "string" ? [{ type: "text", text: content }] : content,
		timestamp: options.timestamp ?? new Date(),
		streamId: readString(options.metadata?.streamId) ?? null,
		replyTo: null,
		attachments: options.attachments ?? [],
		metadata: options.metadata ?? {},
		raw: options.raw ?? null,
	};
}

export function replyTo(
	message: ChannelMessage,
	content: string | ChannelContent[],
): ChannelMessage {
	return {
		id: `msg:${crypto.randomUUID()}`,
		channelId: message.channelId,
		target: message.target,
		from: { id: "assistant", role: "assistant" },
		content: typeof content === "string" ? [{ type: "text", text: content }] : content,
		timestamp: new Date(),
		streamId: message.streamId,
		replyTo: message.id,
		attachments: [],
		metadata: message.metadata,
		raw: null,
	};
}

export function messageText(message: ChannelMessage): string {
	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}
