import {
	Agent as PiAgent,
	type AgentOptions as PiAgentOptions,
} from "@earendil-works/pi-agent-core";
import { createAgentEventStream } from "./event-stream.ts";
import type { AgentEventStream, AgentInput, Agent as RhoAgentInterface } from "./types.ts";

export type RhoAgentOptions = PiAgentOptions;

export class RhoAgent extends PiAgent implements RhoAgentInterface {
	respond(input: AgentInput): AgentEventStream {
		return createAgentEventStream(async (emit) => {
			const unsubscribe = this.subscribe((event) => emit(event));
			const abort = () => this.abort();

			input.signal.addEventListener("abort", abort, { once: true });
			try {
				await this.prompt(input.messages);
				return this.state.messages;
			} finally {
				input.signal.removeEventListener("abort", abort);
				unsubscribe();
			}
		});
	}
}
