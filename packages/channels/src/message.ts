import type { ChannelMessage } from "./types.ts";

export function messageText(message: ChannelMessage): string {
	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}
