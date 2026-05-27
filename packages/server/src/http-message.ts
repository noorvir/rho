import { type ChannelMessage, type ChannelParticipant, channelMessage } from "@rho/channels";

export interface HttpMessageInput {
	conversationId: string;
	sender: ChannelParticipant;
	text: string;
}

export function validateHttpMessage(value: unknown): HttpMessageInput {
	if (!isRecord(value)) throw new Error("Request body must be an object");

	const conversationId = readString(value.conversationId, "conversationId");
	const text = readString(value.text, "text");
	const sender = readSender(value.sender);

	return { conversationId, sender, text };
}

export function messageFromHttp(input: HttpMessageInput, streamId: string): ChannelMessage {
	return channelMessage(input.text, {
		channelId: "http",
		target: { type: "conversation", id: input.conversationId },
		from: input.sender,
		metadata: { streamId },
		raw: input,
	});
}

function readSender(value: unknown): ChannelParticipant {
	if (!isRecord(value)) throw new Error("sender must be an object");
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
