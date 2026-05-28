import { Agent as PiAgent } from "@earendil-works/pi-agent-core";
import {
	type FauxProviderRegistration,
	fauxAssistantMessage,
	registerFauxProvider,
} from "@earendil-works/pi-ai";
import { createAgentEventStream } from "./event-stream.ts";
import { lastUserText } from "./messages.ts";
import type { Agent, AgentEventStream, AgentInput } from "./types.ts";

export class PiEchoAgent implements Agent {
	private readonly registration: FauxProviderRegistration;

	constructor() {
		this.registration = registerFauxProvider({
			api: `rho-echo-${crypto.randomUUID()}`,
			provider: "rho-echo",
			models: [{ id: "rho-echo", name: "rho echo" }],
		});
	}

	respond(input: AgentInput): AgentEventStream {
		return createAgentEventStream(async (emit) => {
			this.registration.appendResponses([
				(context) => fauxAssistantMessage(`echo: ${lastUserText(context) ?? ""}`),
			]);

			const agent = new PiAgent({
				initialState: {
					model: this.registration.getModel(),
				},
			});
			const unsubscribe = agent.subscribe((event) => emit(event));
			const abort = () => agent.abort();

			input.signal.addEventListener("abort", abort, { once: true });
			try {
				await agent.prompt(input.messages);
				return agent.state.messages;
			} finally {
				input.signal.removeEventListener("abort", abort);
				unsubscribe();
			}
		});
	}

	dispose(): void {
		this.registration.unregister();
	}
}
