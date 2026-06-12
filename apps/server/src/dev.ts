#!/usr/bin/env node

import { createServer as createNodeServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { createRhoCore } from "@rho/core";
import { createServer as createViteServer, type ViteDevServer } from "vite";

import { createRhoAuth } from "./auth.ts";
import { installCrashGuards } from "./lib/crash-guards.ts";
import { env } from "./lib/env.ts";
import { createServer } from "./server.ts";

installCrashGuards();

const core = await createRhoCore({
	cwd: process.cwd(),
	agentDir: env.RHO_AGENT_DIR,
	stateDir: env.RHO_STATE_DIR,
	databaseUrl: env.RHO_DATABASE_URL,
	generatedClientDir: env.RHO_GENERATED_CLIENT_DIR,
	dbDir: env.RHO_DB_DIR,
	taskThinkingLevel: env.RHO_TASK_THINKING_LEVEL,
	docsDir: env.RHO_DOCS_DIR,
	extensionsDir: env.RHO_EXTENSIONS_DIR,
	extensionPaths: env.RHO_EXTENSION_PATHS,
});
const auth = createRhoAuth({
	databaseUrl: env.RHO_DATABASE_URL,
	ownerToken: env.RHO_OWNER_TOKEN,
});
const app = createServer({
	core,
	auth,
	databaseUrl: env.RHO_DATABASE_URL,
	appModules: "vite",
});
const apiListener = getRequestListener(app.fetch);
let vite: ViteDevServer | undefined;

const server = createNodeServer((request, response) => {
	if (request.url && isApiPath(new URL(request.url, `http://${request.headers.host}`).pathname)) {
		void apiListener(request, response);
		return;
	}

	const viteServer = vite;
	if (!viteServer) {
		response.statusCode = 503;
		response.end("Vite dev server is starting");
		return;
	}

	viteServer.middlewares(request, response, (error: unknown) => {
		if (error) {
			if (error instanceof Error) {
				viteServer.ssrFixStacktrace(error);
			}
			response.statusCode = 500;
			response.end(error instanceof Error ? error.stack : String(error));
			return;
		}

		response.statusCode = 404;
		response.end("Not Found");
	});
});

vite = await createViteServer({
	root: new URL("../web/", import.meta.url).pathname,
	server: {
		hmr: { server },
		middlewareMode: true,
	},
});

server.listen(env.RHO_PORT, "0.0.0.0", () => {
	console.log(`rho dev server listening on http://localhost:${env.RHO_PORT}`);
	console.log(`active channels: ${core.activeChannelIds().join(", ")}`);
});

async function shutdown(): Promise<void> {
	server.close();
	await vite?.close();
	await core.close();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

function isApiPath(pathname: string): boolean {
	return (
		pathname === "/health" ||
		pathname === "/apps.json" ||
		pathname === "/reload" ||
		pathname === "/tables" ||
		pathname.startsWith("/api/auth/") ||
		pathname.startsWith("/tables/") ||
		pathname.startsWith("/agent/") ||
		isAppApiPath(pathname)
	);
}

function isAppApiPath(pathname: string): boolean {
	const parts = pathname.split("/");
	return parts[1] === "apps" && Boolean(parts[2]) && parts[3] === "api";
}
