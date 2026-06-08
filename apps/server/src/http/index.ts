import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RequestHeadersPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";
import type { RhoCore } from "@rho/core";
import type { MiddlewareHandler } from "hono";
import type { RhoAuth } from "../auth.ts";
import { agentRouter } from "./agent.ts";
import { appsRouter } from "./apps.ts";
import { authRouter } from "./auth.ts";
import { dataRouter } from "./data.ts";
import type { HttpContext } from "./types.ts";

export interface HttpOptions {
	auth: RhoAuth;
	core: RhoCore;
	databaseUrl: string;
}

const httpRouter = {
	apps: appsRouter(),
	auth: authRouter(),
	data: dataRouter(),
	agent: agentRouter(),
};

export function createHttpMiddleware(options: HttpOptions): MiddlewareHandler {
	const handler = new OpenAPIHandler<HttpContext>(httpRouter, {
		plugins: [new RequestHeadersPlugin(), new ResponseHeadersPlugin()],
		customErrorResponseBodyEncoder: (error) => ({ error: error.message }),
	});

	return async (context, next) => {
		const result = await handler.handle(context.req.raw, {
			context: {
				auth: options.auth,
				core: options.core,
				databaseUrl: options.databaseUrl,
				requestUrl: context.req.url,
			},
		});
		if (result.matched) {
			return result.response;
		}

		await next();
	};
}
