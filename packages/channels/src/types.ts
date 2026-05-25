export type ChannelKind = "cli" | "web" | "mobile" | "chat" | (string & {});

export type ConversationType = "dm" | "group" | "channel" | "thread" | (string & {});

export interface ConversationBase {
	id: string;
	type: ConversationType;
}

export interface ThreadConversation extends ConversationBase {
	type: "thread";
	threadId: string;
}

export type Conversation = ConversationBase | ThreadConversation;

export interface Sender {
	id: string;
	name: string;
}

export interface AttachmentBase {
	id: string;
	mediaType: string;
	name: string;
}

export interface UrlAttachment extends AttachmentBase {
	kind: "url";
	url: string;
}

export interface DataAttachment extends AttachmentBase {
	kind: "data";
	data: Uint8Array;
}

export type Attachment = UrlAttachment | DataAttachment;

export interface InboundMessage {
	id: string;
	channel: string;
	conversation: Conversation;
	sender: Sender;
	text: string;
	timestamp: Date;
	attachments: Attachment[];
	metadata: Record<string, unknown>;
	raw: unknown | null;
}

export interface ConversationTarget {
	kind: "conversation";
	conversationId: string;
}

export interface ThreadTarget {
	kind: "thread";
	conversationId: string;
	threadId: string;
}

export type ChannelTarget = ConversationTarget | ThreadTarget;

export interface OutboundMessage {
	channel: string;
	target: ChannelTarget;
	text: string;
	replyTo: string | null;
	attachments: Attachment[];
	metadata: Record<string, unknown>;
}

export type SendReceipt =
	| {
			ok: true;
			messageId: string;
			raw: unknown | null;
	  }
	| {
			ok: false;
			retryable: boolean;
			error: string;
			raw: unknown | null;
	  };

export interface ChannelContext {
	receive(message: InboundMessage): Promise<void>;
	signal: AbortSignal;
}

export interface Channel {
	name: string;
	kind: ChannelKind;
	start(context: ChannelContext): Promise<void>;
	stop(): Promise<void>;
	send(message: OutboundMessage): Promise<SendReceipt>;
}
