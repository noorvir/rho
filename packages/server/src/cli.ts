#!/usr/bin/env node

import { serve } from "@hono/node-server";
import { agentEventTextDelta, PiEchoAgent } from "@rho/ai";
import { type ChannelMessage, ChannelRuntime, HttpChannel, messageText } from "@rho/channels";
import { ChannelRegistry } from "./channel-registry.ts";
import { EmptyRegistrySource, reload } from "./reload.ts";
import { createServer } from "./server.ts";

const port = Number(process.env.RHO_PORT ?? "7331");
const agent = new PiEchoAgent();
const httpChannel = new HttpChannel();
const channels = new ChannelRegistry([httpChannel]);
const files = new EmptyRegistrySource();

const runtime = new ChannelRuntime({
	channels: channels.current(),
	handle: async (message) => agentResponse(message),
});

await reload({ runtime, channels, httpChannel, files });

const server = serve({
	fetch: createServer({ runtime, httpChannel, channels, files }).fetch,
	hostname: "0.0.0.0",
	port,
});

console.log(`rho server listening on http://localhost:${port}`);
console.log(
	`active channels: ${channels
		.current()
		.map((channel) => channel.id)
		.join(", ")}`,
);

async function* agentResponse(message: ChannelMessage): AsyncIterable<ChannelMessage> {
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

function shutdown(): void {
	server.close(async () => {
		await runtime.stop();
		agent.dispose();
	});
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
