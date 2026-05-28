import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";

export interface AgentInput {
	messages: AgentMessage[];
	signal: AbortSignal;
}

export interface AgentEventStream extends AsyncIterable<AgentEvent> {
	result(): Promise<AgentMessage[]>;
}

export interface Agent {
	respond(input: AgentInput): AgentEventStream;
}

export type RhoContent = TextContent | ImageContent;
