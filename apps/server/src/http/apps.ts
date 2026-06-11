import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { RhoAppApiContext, RhoCore } from "@rho/core";
import { tc } from "@rho/lib";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { authSessionCookieName, type RhoAuth } from "../auth.ts";
import {
	type RhoErrorCode,
	type RhoErrorOptions,
	rhoError,
	rhoErrorResponseBody,
	throwRhoError,
} from "../errors.ts";
import { bundleAppClient, bundleAppStyles } from "../lib/app-bundles.ts";
import { requireAuth } from "./auth.ts";
import { httpContract } from "./contract.ts";
import type { AppModuleMode, HttpContext } from "./types.ts";

const p = implement(httpContract).$context<HttpContext>();

export function appsRouter() {
	return {
		list: p.apps.list.handler(async ({ context }) => {
			await requireAuth(context);
			const res = await tc(context.core.listApps());
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to list apps." });
			}

			const apps = res.data.map((app) => ({
				slug: app.slug,
				name: app.name,
				clientModuleUrl: clientModuleUrl(app, context.appModules),
				clientStylesUrl: context.appModules === "bundle" ? `/apps/${app.slug}/client.css` : undefined,
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
				throwRhoError("server.internal", { message: "Failed to reload apps." });
			}

			return res.data;
		}),
	};
}

export function getDynamicAppsApiRoutes(ctx: { auth: RhoAuth; core: RhoCore }): Hono {
	const app = new Hono();

	app.use("/:slug/api/*", appApiAuth(ctx.auth));
	app.all("/:slug/api/*", async (context) => handleAppApi(context, ctx.core));

	app.use("/:slug/client.js", appApiAuth(ctx.auth));
	app.get("/:slug/client.js", async (context) => handleAppClientModule(context, ctx.core));

	app.use("/:slug/client.css", appApiAuth(ctx.auth));
	app.get("/:slug/client.css", async (context) => handleAppClientStyles(context, ctx.core));

	return app;
}

async function handleAppClientStyles(context: Context, core: RhoCore): Promise<Response> {
	const slug = context.req.param("slug");
	const apps = await tc(core.listApps());
	if (apps.error) {
		return rhoJsonError("server.internal", { message: "Failed to list apps." });
	}

	const app = apps.data.find((candidate) => candidate.slug === slug);
	if (!app) {
		return rhoJsonError("apps.api_not_found", { details: { app: slug ?? "" } });
	}

	const styles = await tc(bundleAppStyles(app.client.entry));
	if (styles.error) {
		console.error("app client styles failed:", styles.error);
		return rhoJsonError("server.internal", { message: "Failed to build the app styles." });
	}

	return new Response(styles.data, {
		headers: {
			"Content-Type": "text/css; charset=utf-8",
			"Cache-Control": "no-cache",
		},
	});
}

async function handleAppClientModule(context: Context, core: RhoCore): Promise<Response> {
	const slug = context.req.param("slug");
	const apps = await tc(core.listApps());
	if (apps.error) {
		return rhoJsonError("server.internal", { message: "Failed to list apps." });
	}

	const app = apps.data.find((candidate) => candidate.slug === slug);
	if (!app) {
		return rhoJsonError("apps.api_not_found", { details: { app: slug ?? "" } });
	}

	const bundle = await tc(bundleAppClient(app.client.entry));
	if (bundle.error) {
		console.error("app client bundle failed:", bundle.error);
		return rhoJsonError("server.internal", { message: "Failed to build the app module." });
	}

	return new Response(bundle.data, {
		headers: {
			"Content-Type": "text/javascript; charset=utf-8",
			"Cache-Control": "no-cache",
		},
	});
}

async function handleAppApi(context: Context, core: RhoCore): Promise<Response> {
	const slug = context.req.param("slug");
	const apps = await tc(core.listApps());
	if (apps.error) {
		return rhoJsonError("server.internal", { message: "Failed to list apps." });
	}

	const app = apps.data.find((candidate) => candidate.slug === slug);
	if (!app?.api) {
		return rhoJsonError("apps.api_not_found", { details: { app: slug ?? "" } });
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

	return result.matched ? result.response : rhoJsonError("apps.procedure_not_found");
}

function appApiAuth(auth: RhoAuth): MiddlewareHandler {
	return async (context, next) => {
		const bearerToken = requestBearerToken(context);
		const sessionToken = getCookie(context, authSessionCookieName);
		const principal = await tc(auth.authorize({ bearerToken, sessionToken }));
		if (principal.error) {
			return rhoJsonError("server.internal", { message: "Failed to authorize request." });
		}
		if (!principal.data) {
			return rhoJsonError("auth.session_required");
		}

		await next();
	};
}

function rhoJsonError(code: RhoErrorCode, options?: RhoErrorOptions): Response {
	const error = rhoError(code, options);
	return Response.json(rhoErrorResponseBody(error), { status: error.status });
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

function clientModuleUrl(app: { slug: string; client: { entry: string } }, mode: AppModuleMode): string {
	if (mode === "vite") {
		return `/@fs${app.client.entry}`;
	}
	return `/apps/${app.slug}/client.js`;
}
