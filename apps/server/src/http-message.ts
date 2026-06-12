import type { ChannelContent, ChannelMessage, ChannelParticipant } from "@rho/channels";
import { type RhoStore, storeMimeType } from "./store.ts";

export interface HttpMessageInput {
	conversationId: string;
	sender: ChannelParticipant;
	text: string;
	attachments: HttpMessageAttachment[];
}

export interface HttpMessageAttachment {
	path: string;
}

export function validateHttpMessage(value: unknown): HttpMessageInput {
	if (!isRecord(value)) {
		throw new Error("Request body must be an object");
	}

	const conversationId = readString(value.conversationId, "conversationId");
	const sender = readSender(value.sender);
	const attachments = readAttachments(value.attachments);
	const text = typeof value.text === "string" ? value.text : "";
	if (text.trim() === "" && attachments.length === 0) {
		throw new Error("text must be a non-empty string when there are no attachments");
	}

	return { conversationId, sender, text, attachments };
}

export function messageFromHttp(input: HttpMessageInput, store: RhoStore): ChannelMessage {
	const content: ChannelContent[] = [{ type: "text", text: promptText(input) }];

	for (const attachment of input.attachments) {
		const mimeType = storeMimeType(attachment.path);
		if (!mimeType.startsWith("image/")) {
			continue;
		}

		content.push({
			type: "image",
			media: {
				kind: "file",
				id: attachment.path,
				mimeType,
				sizeBytes: null,
				path: store.resolve(attachment.path),
			},
			altText: null,
		});
	}

	return {
		id: `msg:${crypto.randomUUID()}`,
		channelId: "http",
		target: { type: "conversation", id: input.conversationId },
		from: input.sender,
		content,
		timestamp: new Date(),
		replyTo: null,
		attachments: [],
		metadata: {},
		raw: input,
	};
}

export function conversationKey(conversationId: string): string {
	return `http:conversation:${conversationId}`;
}

/**
 * The user text plus one `[attachment: <path> (<mime>)]` line per attachment.
 * The lines land in the agent transcript, so the model knows where each file
 * lives in the store, and history rebuilds attachment references from them.
 */
function promptText(input: HttpMessageInput): string {
	const lines = input.attachments.map(
		(attachment) => `[attachment: ${attachment.path} (${storeMimeType(attachment.path)})]`,
	);
	if (lines.length === 0) {
		return input.text;
	}

	const text = input.text.trim();
	return text === "" ? lines.join("\n") : `${text}\n\n${lines.join("\n")}`;
}

function readAttachments(value: unknown): HttpMessageAttachment[] {
	if (value === undefined || value === null) {
		return [];
	}
	if (!Array.isArray(value)) {
		throw new Error("attachments must be an array");
	}

	return value.map((entry, index) => {
		if (!isRecord(entry)) {
			throw new Error(`attachments[${index}] must be an object`);
		}
		return { path: readString(entry.path, `attachments[${index}].path`) };
	});
}

function readSender(value: unknown): ChannelParticipant {
	if (!isRecord(value)) {
		throw new Error("sender must be an object");
	}

	return {
		id: readString(value.id, "sender.id"),
		role: "user",
	};
}

function readString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${field} must be a non-empty string`);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
