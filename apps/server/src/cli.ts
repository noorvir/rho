#!/usr/bin/env node

import { serve } from "@hono/node-server";
import { createRhoCore } from "@rho/core";

import { env } from "./lib/env.ts";
import { createServer } from "./server.ts";

const webRoot = new URL("../web/dist/", import.meta.url).pathname;
const core = await createRhoCore({ extensionPaths: env.extensionPaths });

const server = serve({
	fetch: createServer({ core, apiSecret: env.apiSecret, webRoot }).fetch,
	hostname: "0.0.0.0",
	port: env.port,
});

console.log(`rho server listening on http://localhost:${env.port}`);
console.log(`active channels: ${core.activeChannelIds().join(", ")}`);

function shutdown(): void {
	server.close(() => {
		core.close().catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : error);
		});
	});
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
