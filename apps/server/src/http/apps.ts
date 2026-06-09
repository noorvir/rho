import { implement, ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { RhoAppApiContext, RhoCore } from "@rho/core";
import { tc } from "@rho/lib";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { authSessionCookieName, type RhoAuth } from "../auth.ts";
import { requireAuth } from "./auth.ts";
import { httpContract } from "./contract.ts";
import type { HttpContext } from "./types.ts";

const p = implement(httpContract).$context<HttpContext>();

export function appsRouter() {
	return {
		list: p.apps.list.handler(async ({ context }) => {
				await requireAuth(context);
				const res = await tc(context.core.listApps());
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to list apps",
					});
				}

				const apps = res.data.map((app) => ({
					slug: app.slug,
					name: app.name,
					clientModuleUrl: sourceModuleUrl(app.client.entry),
					routes: app.routes.map((route) => ({
						path: route.path,
						label: route.label,
					})),
					apiBasePath: app.api ? `/apps/${app.slug}${app.api.basePath}` : undefined,
				}));

				return { apps };
			}),

		reload: p.apps.reload.handler(async ({ context }) => {
				await requireAuth(context);
				const res = await tc(context.core.reload());
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to reload apps",
					});
				}

				return res.data;
			}),
	};
}

export function getDynamicAppsApiRoutes(ctx: { auth: RhoAuth; core: RhoCore }): Hono {
	const app = new Hono();

	app.use("/:slug/api/*", appApiAuth(ctx.auth));
	app.all("/:slug/api/*", async (context) => handleAppApi(context, ctx.core));

	return app;
}

async function handleAppApi(context: Context, core: RhoCore): Promise<Response> {
	const slug = context.req.param("slug");
	const apps = await tc(core.listApps());
	if (apps.error) {
		return context.json({ error: "Failed to list apps" }, 500);
	}

	const app = apps.data.find((candidate) => candidate.slug === slug);
	if (!app?.api) {
		return context.json({ error: "Unknown app API" }, 404);
	}

	const externalApiBasePath: `/${string}` = `/apps/${app.slug}${app.api.basePath}`;
	const handler = new RPCHandler<RhoAppApiContext>(app.api.router);
	const result = await handler.handle(context.req.raw, {
		prefix: externalApiBasePath,
		context: {
			app: {
				slug: app.slug,
				name: app.name,
				basePath: `/apps/${app.slug}`,
				apiBasePath: externalApiBasePath,
			},
			host: {
				platform: hostPlatform(context),
			},
		},
	});

	return result.matched ? result.response : context.json({ error: "Unknown app procedure" }, 404);
}

function appApiAuth(auth: RhoAuth): MiddlewareHandler {
	return async (context, next) => {
		const bearerToken = requestBearerToken(context);
		const sessionToken = getCookie(context, authSessionCookieName);
		const principal = await tc(auth.authorize({ bearerToken, sessionToken }));
		if (principal.error) {
			return context.json({ error: "Failed to authorize request" }, 500);
		}
		if (!principal.data) {
			return context.json({ error: "Unauthorized" }, 401);
		}

		await next();
	};
}

function requestBearerToken(context: Context): string | undefined {
	const authorization = context.req.header("Authorization");
	if (!authorization?.startsWith("Bearer ")) {
		return undefined;
	}

	const token = authorization.slice("Bearer ".length).trim();
	return token || undefined;
}

function hostPlatform(context: Context): RhoAppApiContext["host"]["platform"] {
	const value = context.req.header("X-Rho-Platform");
	return value === "mobile" || value === "desktop" ? value : "web";
}

function sourceModuleUrl(path: string): string {
	return `/@fs${path}`;
}
