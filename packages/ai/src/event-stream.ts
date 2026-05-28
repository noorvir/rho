import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import { EventStream } from "@earendil-works/pi-ai";
import type { AgentEventStream } from "./types.ts";

export function createAgentEventStream(
	run: (emit: (event: AgentEvent) => void) => Promise<AgentMessage[]>,
): AgentEventStream {
	const stream = new EventStream<AgentEvent, AgentMessage[]>(
		(event) => event.type === "agent_end",
		(event) => (event.type === "agent_end" ? event.messages : []),
	);

	run((event) => stream.push(event))
		.then((messages) => stream.end(messages))
		.catch((error: unknown) => {
			stream.end(Promise.reject(error) as never);
		});

	return stream;
}
