#!/usr/bin/env node

import { PiEchoAgent } from "@rho/ai";
import { ChannelRuntime, CliChannel, inboundMessage, replyTo } from "@rho/channels";

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
		handle: async (message) => {
			const reply = await agent.reply({ text: message.text, timestamp: message.timestamp });
			return replyTo(message, reply.text);
		},
	});

	try {
		await runtime.receive(inboundMessage(text));
	} finally {
		agent.dispose();
	}
}

await main();
