#!/usr/bin/env node

import { serve } from "@hono/node-server";
import { PiEchoAgent } from "@rho/ai";
import { ChannelRuntime, HttpChannel, messageText, replyTo } from "@rho/channels";
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
	handle: async (message) => {
		const reply = await agent.reply({ text: messageText(message), timestamp: message.timestamp });
		return replyTo(message, reply.text);
	},
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

function shutdown(): void {
	server.close(async () => {
		await runtime.stop();
		agent.dispose();
	});
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
