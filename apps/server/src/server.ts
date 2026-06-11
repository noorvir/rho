import { relative } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { RhoCore } from "@rho/core";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import type { RhoAuth } from "./auth.ts";
import { getDynamicAppsApiRoutes } from "./http/apps.ts";
import { createHttpMiddleware } from "./http/index.ts";
import type { AppModuleMode } from "./http/types.ts";

export interface ServerOptions {
	core: RhoCore;
	auth: RhoAuth;
	databaseUrl: string;
	/** How app client modules are delivered: vite dev URLs or server-built bundles. */
	appModules: AppModuleMode;
	webRoot?: string;
}

export function createServer(options: ServerOptions): Hono {
	const app = new Hono();
	const webRoot = options.webRoot ? relative(process.cwd(), options.webRoot) : undefined;

	app.use(
		"*",
		cors({
			allowHeaders: ["Authorization", "Content-Type"],
			allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
			origin: "*",
		}),
	);
	app.get("/health", (context) => context.json({ ok: true }));

	app.route("/apps", getDynamicAppsApiRoutes(options));
	app.use("*", createHttpMiddleware(options));

	if (webRoot) {
		app.use("*", serveStatic({ root: webRoot }));

		const serveWebApp = serveStatic({ root: webRoot, path: "index.html" });
		app.get("*", async (context) => {
			if (!acceptsHtml(context)) {
				return context.notFound();
			}

			const response = await serveWebApp(context, async () => {});
			return response ?? context.notFound();
		});
	}

	return app;
}

function acceptsHtml(context: Context): boolean {
	return context.req.header("Accept")?.includes("text/html") ?? false;
}
