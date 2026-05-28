#!/usr/bin/env node

import { agentEventTextDelta, PiEchoAgent } from "@rho/ai";
import { type ChannelMessage, ChannelRuntime, CliChannel, messageText } from "@rho/channels";

export async function main(args = process.argv.slice(2)): Promise<void> {
	const text = args.join(" ").trim();

	if (!text) {
		console.error("Usage: rho <message>");
		process.exitCode = 1;
		return;
	}

	const agent = new PiEchoAgent();
	const runtime = new ChannelRuntime({
		channels: [new CliChannel()],
		handle: async (message) => agentResponse(agent, message),
	});

	try {
		await runtime.receive({
			id: `msg:${crypto.randomUUID()}`,
			channelId: "cli",
			target: { type: "conversation", id: "cli" },
			from: { id: "cli-user", role: "user" },
			content: [{ type: "text", text }],
			timestamp: new Date(),
			replyTo: null,
			attachments: [],
			metadata: {},
			raw: null,
		});
	} finally {
		agent.dispose();
	}
}

async function* agentResponse(
	agent: PiEchoAgent,
	message: ChannelMessage,
): AsyncIterable<ChannelMessage> {
	const stream = agent.respond({
		messages: [
			{
				role: "user",
				content: messageText(message),
				timestamp: message.timestamp.getTime(),
			},
		],
		signal: new AbortController().signal,
	});

	for await (const event of stream) {
		const delta = agentEventTextDelta(event);
		if (delta) {
			yield {
				id: `msg:${crypto.randomUUID()}`,
				channelId: message.channelId,
				target: message.target,
				from: { id: "assistant", role: "assistant" },
				content: [{ type: "text", text: delta }],
				timestamp: new Date(),
				replyTo: message.id,
				attachments: [],
				metadata: message.metadata,
				raw: null,
			};
		}
	}
}

await main();
