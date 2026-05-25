import {
	type AssistantMessage,
	type Context,
	complete,
	type FauxProviderRegistration,
	fauxAssistantMessage,
	registerFauxProvider,
} from "@earendil-works/pi-ai";
import type { Agent, AgentInput, AgentReply } from "./types.ts";

export type { Agent, AgentInput, AgentReply } from "./types.ts";

export class EchoAgent implements Agent {
	async reply(input: AgentInput): Promise<AgentReply> {
		return { text: `echo: ${input.text}` };
	}
}

export class PiEchoAgent implements Agent {
	private readonly registration: FauxProviderRegistration;

	constructor() {
		this.registration = registerFauxProvider({
			api: `rho-echo-${crypto.randomUUID()}`,
			provider: "rho-echo",
			models: [{ id: "rho-echo", name: "rho echo" }],
		});
	}

	async reply(input: AgentInput): Promise<AgentReply> {
		this.registration.appendResponses([
			(context) => fauxAssistantMessage(`echo: ${lastUserText(context) ?? input.text}`),
		]);

		const response = await complete(this.registration.getModel(), {
			messages: [
				{
					role: "user",
					content: input.text,
					timestamp: input.timestamp.getTime(),
				},
			],
		});

		return {
			text: assistantText(response),
			raw: response,
		};
	}

	dispose(): void {
		this.registration.unregister();
	}
}

function lastUserText(context: Context): string | undefined {
	const message = [...context.messages].reverse().find((candidate) => candidate.role === "user");
	if (!message || message.role !== "user") return undefined;
	return typeof message.content === "string"
		? message.content
		: message.content
				.filter((part) => part.type === "text")
				.map((part) => part.text)
				.join("\n");
}

function assistantText(message: AssistantMessage): string {
	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}
