#!/usr/bin/env node

import { serve } from "@hono/node-server";
import { createRhoCore } from "@rho/core";

import { createRhoAuth } from "./auth.ts";
import { installCrashGuards } from "./lib/crash-guards.ts";
import { env } from "./lib/env.ts";
import { createServer } from "./server.ts";

installCrashGuards();

const webRoot = new URL("../web/dist/", import.meta.url).pathname;
const core = await createRhoCore({
	cwd: process.cwd(),
	agentDir: env.RHO_AGENT_DIR,
	stateDir: env.RHO_STATE_DIR,
	databaseUrl: env.RHO_DATABASE_URL,
	generatedClientDir: env.RHO_GENERATED_CLIENT_DIR,
	dbDir: env.RHO_DB_DIR,
	docsDir: env.RHO_DOCS_DIR,
	extensionsDir: env.RHO_EXTENSIONS_DIR,
	extensionPaths: env.RHO_EXTENSION_PATHS,
});
const auth = createRhoAuth({
	databaseUrl: env.RHO_DATABASE_URL,
	ownerToken: env.RHO_OWNER_TOKEN,
});

const server = serve({
	fetch: createServer({
		core,
		auth,
		databaseUrl: env.RHO_DATABASE_URL,
		appModules: "bundle",
		webRoot,
	}).fetch,
	hostname: "0.0.0.0",
	port: env.RHO_PORT,
});

console.log(`rho server listening on http://localhost:${env.RHO_PORT}`);
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
