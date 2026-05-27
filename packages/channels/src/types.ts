export type ChannelId = string & {};
export type MessageId = string & {};
export type ConversationId = string & {};
export type RealtimeSessionId = string & {};
export type ChannelKind = "cli" | "http" | "web" | "mobile" | "chat";

export type ConversationType = "dm" | "group" | "channel" | "thread";

export interface ConversationBase {
	id: ConversationId;
	type: ConversationType;
}

export interface ThreadConversation extends ConversationBase {
	type: "thread";
	threadId: string;
}

export type Conversation = ConversationBase | ThreadConversation;

export interface ChannelParticipant {
	id: string;
	role: "user" | "assistant" | "system";
}

export interface MediaRefBase {
	id: string;
	mimeType: string;
	sizeBytes: number | null;
}

export interface UrlMediaRef extends MediaRefBase {
	kind: "url";
	url: string;
}

export interface DataMediaRef extends MediaRefBase {
	kind: "data";
	data: Uint8Array;
}

export interface FileMediaRef extends MediaRefBase {
	kind: "file";
	path: string;
}

export interface ChannelMediaRef extends MediaRefBase {
	kind: "channel";
	channelId: ChannelId;
	mediaId: string;
}

export type MediaRef = UrlMediaRef | DataMediaRef | FileMediaRef | ChannelMediaRef;

export interface TextContent {
	type: "text";
	text: string;
}

export interface ImageContent {
	type: "image";
	media: MediaRef;
	altText: string | null;
}

export interface AudioContent {
	type: "audio";
	media: MediaRef;
}

export interface VideoContent {
	type: "video";
	media: MediaRef;
}

export interface FileContent {
	type: "file";
	media: MediaRef;
	name: string;
}

export type ChannelContent =
	| TextContent
	| ImageContent
	| AudioContent
	| VideoContent
	| FileContent;

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

export interface FileAttachment extends AttachmentBase {
	kind: "file";
	path: string;
}

export type Attachment = UrlAttachment | DataAttachment | FileAttachment;

export interface ChannelMessage {
	id: MessageId;
	channelId: ChannelId;
	conversation: Conversation;
	from: ChannelParticipant;
	content: ChannelContent[];
	timestamp: Date;
	streamId: string | null;
	replyTo: MessageId | null;
	attachments: Attachment[];
	metadata: Record<string, unknown>;
	raw: unknown | null;
}

export type ChannelMessageStream = AsyncIterable<ChannelMessage>;

export type ChannelOutput = ChannelMessage | ChannelMessageStream;

export type SendReceipt =
	| {
			ok: true;
			messageId: MessageId;
			raw: unknown | null;
	  }
	| {
			ok: false;
			retryable: boolean;
			error: string;
			raw: unknown | null;
	  };

export interface ChannelContext {
	receive(message: ChannelMessage): Promise<void>;
	signal: AbortSignal;
}

export interface RealtimeSessionRequest {
	id: RealtimeSessionId;
	channelId: ChannelId;
	metadata: Record<string, unknown>;
	raw: unknown | null;
}

export type RealtimeContent = AudioContent | VideoContent;

export interface RealtimeFrame {
	sessionId: RealtimeSessionId;
	channelId: ChannelId;
	sequence: number;
	content: RealtimeContent;
	timestamp: Date;
	metadata: Record<string, unknown>;
	raw: unknown | null;
}

export type RealtimeFrameStream = AsyncIterable<RealtimeFrame>;

export interface RealtimeSession {
	id: RealtimeSessionId;
	channelId: ChannelId;
	receive(input: RealtimeFrame | RealtimeFrameStream): Promise<void>;
	send(output: RealtimeFrame | RealtimeFrameStream): Promise<void>;
	interrupt(reason: "barge-in" | "stop" | "disconnect" | "error"): Promise<void>;
	close(): Promise<void>;
}

export interface Channel {
	id: ChannelId;
	kind: ChannelKind;
	start(context: ChannelContext): Promise<void>;
	stop(): Promise<void>;
	send(output: ChannelOutput): Promise<SendReceipt>;
}

export interface RealtimeChannel extends Channel {
	open(request: RealtimeSessionRequest): Promise<RealtimeSession>;
}
