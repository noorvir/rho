import type {
	Channel,
	ChannelTarget,
	Conversation,
	InboundMessage,
	OutboundMessage,
	SendReceipt,
} from "./types.ts";

export type {
	Attachment,
	AttachmentBase,
	Channel,
	ChannelContext,
	ChannelKind,
	ChannelTarget,
	Conversation,
	ConversationBase,
	ConversationTarget,
	ConversationType,
	DataAttachment,
	InboundMessage,
	OutboundMessage,
	Sender,
	SendReceipt,
	ThreadConversation,
	ThreadTarget,
	UrlAttachment,
} from "./types.ts";

export type ChannelHandler = (message: InboundMessage) => Promise<OutboundMessage>;

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
			this.channels.set(channel.name, channel);
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

	async receive(message: InboundMessage): Promise<SendReceipt> {
		const channel = this.channels.get(message.channel);
		if (!channel) {
			throw new Error(`Unknown channel: ${message.channel}`);
		}

		const outbound = await this.handle(message);
		return channel.send(outbound);
	}
}

export class CliChannel implements Channel {
	readonly name = "cli";
	readonly kind = "cli";

	constructor(private readonly output: Pick<NodeJS.WritableStream, "write"> = process.stdout) {}

	async start(): Promise<void> {}

	async stop(): Promise<void> {}

	async send(message: OutboundMessage): Promise<SendReceipt> {
		this.output.write(`${message.text}\n`);
		return {
			ok: true,
			messageId: `cli:${Date.now()}`,
			raw: null,
		};
	}
}

export interface InboundMessageOptions {
	id?: string;
	channel?: string;
	conversation?: InboundMessage["conversation"];
	sender?: InboundMessage["sender"];
	timestamp?: Date;
	attachments?: InboundMessage["attachments"];
	metadata?: InboundMessage["metadata"];
	raw?: unknown | null;
}

export function inboundMessage(text: string, options: InboundMessageOptions = {}): InboundMessage {
	return {
		id: options.id ?? `msg:${crypto.randomUUID()}`,
		channel: options.channel ?? "cli",
		conversation: options.conversation ?? { id: "cli", type: "dm" },
		sender: options.sender ?? { id: "cli-user", name: "CLI User" },
		text,
		timestamp: options.timestamp ?? new Date(),
		attachments: options.attachments ?? [],
		metadata: options.metadata ?? {},
		raw: options.raw ?? null,
	};
}

export function replyTo(message: InboundMessage, text: string): OutboundMessage {
	return {
		channel: message.channel,
		target: targetForConversation(message.conversation),
		text,
		replyTo: message.id,
		attachments: [],
		metadata: {},
	};
}

function targetForConversation(conversation: Conversation): ChannelTarget {
	if ("threadId" in conversation) {
		return {
			kind: "thread",
			conversationId: conversation.id,
			threadId: conversation.threadId,
		};
	}

	return {
		kind: "conversation",
		conversationId: conversation.id,
	};
}
