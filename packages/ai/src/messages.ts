import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { Context } from "@earendil-works/pi-ai";

export function agentEventTextDelta(event: AgentEvent): string | undefined {
	return event.type === "message_update" && event.assistantMessageEvent.type === "text_delta"
		? event.assistantMessageEvent.delta
		: undefined;
}

export function lastUserText(context: Context): string | undefined {
	const message = [...context.messages].reverse().find((candidate) => candidate.role === "user");
	if (!message || message.role !== "user") return undefined;
	return typeof message.content === "string"
		? message.content
		: message.content
				.filter((part) => part.type === "text")
				.map((part) => part.text)
				.join("\n");
}
