#!/usr/bin/env node

import { createServer as createNodeServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { createRhoCore } from "@rho/core";
import { createServer as createViteServer, type ViteDevServer } from "vite";

import { createServer } from "./server.ts";

const port = Number(process.env.PORT ?? process.env.RHO_PORT ?? "7331");
const apiSecret = process.env.RHO_API_SECRET;
const core = await createRhoCore();
const app = createServer({ core, apiSecret });
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

server.listen(port, "0.0.0.0", () => {
	console.log(`rho dev server listening on http://localhost:${port}`);
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
		pathname === "/reload" ||
		pathname === "/tables" ||
		pathname.startsWith("/tables/") ||
		pathname.startsWith("/agent/")
	);
}
