#!/usr/bin/env node

import { serve } from "@hono/node-server";
import { createRhoCore } from "@rho/core";
import { createServer } from "./server.ts";

const port = Number(process.env.PORT ?? process.env.RHO_PORT ?? "7331");
const apiSecret = process.env.RHO_API_SECRET;
const core = await createRhoCore();

const server = serve({
	fetch: createServer({ core, apiSecret }).fetch,
	hostname: "0.0.0.0",
	port,
});

console.log(`rho server listening on http://localhost:${port}`);
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
