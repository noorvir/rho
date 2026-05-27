import type { ChannelContent, ChannelMessage, ChannelOutput } from "./types.ts";

export function replyTo(
	message: ChannelMessage,
	content: string | ChannelContent[],
): ChannelMessage {
	return {
		id: `msg:${crypto.randomUUID()}`,
		channelId: message.channelId,
		target: message.target,
		from: { id: "assistant", role: "assistant" },
		content: contentParts(content),
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

export async function* channelMessages(output: ChannelOutput): AsyncIterable<ChannelMessage> {
	if (Symbol.asyncIterator in output) {
		yield* output;
		return;
	}

	yield output;
}

function contentParts(content: string | ChannelContent[]): ChannelContent[] {
	return typeof content === "string" ? [{ type: "text", text: content }] : content;
}
