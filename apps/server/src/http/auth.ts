import { ORPCError, os } from "@orpc/server";
import { deleteCookie, getCookie, setCookie } from "@orpc/server/helpers";
import { tc } from "@rho/lib";
import * as z from "zod";
import { authSessionCookieName, type RhoAuthSession } from "../auth.ts";
import type { HttpContext } from "./types.ts";

const p = os.$context<HttpContext>();
const authenticated = p.use(async ({ context, next }) => {
	await requireAuth(context);
	return next();
});

export function authRouter() {
	return {
		status: p
			.route({
				method: "GET",
				path: "/api/auth/setup",
			})
			.handler(async ({ context }) => {
				const res = await tc(context.auth.setupRequired());
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to load auth setup status",
					});
				}

				return { setupRequired: res.data };
			}),

		setup: p
			.route({
				method: "POST",
				path: "/api/auth/setup",
			})
			.input(
				z.object({
					ownerToken: z.string().min(1),
					password: z.string().min(1),
				}),
			)
			.handler(async ({ input, context }) => {
				const res = await tc(context.auth.setup(input));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to set up auth",
					});
				}

				const result = res.data;
				if (result.status === "already-complete") {
					throw new ORPCError("CONFLICT", { message: "Setup is already complete" });
				}
				if (result.status === "unauthorized") {
					throw new ORPCError("UNAUTHORIZED");
				}

				setSessionCookie(context, result.session);
				return { authenticated: true, principal: result.session.principal };
			}),

		login: p
			.route({
				method: "POST",
				path: "/api/auth/login",
			})
			.input(z.object({ password: z.string().min(1) }))
			.handler(async ({ input, context }) => {
				const setupRequired = await tc(context.auth.setupRequired());
				if (setupRequired.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to load auth setup status",
					});
				}
				if (setupRequired.data) {
					throw new ORPCError("CONFLICT", { message: "Setup required" });
				}

				const res = await tc(context.auth.login(input));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to log in",
					});
				}

				const session = res.data;
				if (!session) {
					throw new ORPCError("UNAUTHORIZED");
				}

				setSessionCookie(context, session);
				return { authenticated: true, principal: session.principal };
			}),

		getToken: p
			.route({
				method: "POST",
				path: "/api/auth/token/login",
			})
			.input(
				z.object({
					password: z.string().min(1),
				}),
			)
			.handler(async ({ input, context }) => {
				const res = await tc(context.auth.getToken(input));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to log in",
					});
				}

				const tokens = res.data;
				if (!tokens) {
					throw new ORPCError("UNAUTHORIZED");
				}

				return tokens;
			}),

		refreshToken: p
			.route({
				method: "POST",
				path: "/api/auth/token/refresh",
			})
			.input(z.object({ refreshToken: z.string().min(1) }))
			.handler(async ({ input, context }) => {
				const res = await tc(context.auth.refreshToken(input.refreshToken));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to refresh session",
					});
				}

				const tokens = res.data;
				if (!tokens) {
					throw new ORPCError("UNAUTHORIZED");
				}

				return tokens;
			}),

		revokeToken: p
			.route({
				method: "POST",
				path: "/api/auth/token/logout",
			})
			.input(z.object({ refreshToken: z.string().min(1) }))
			.handler(async ({ input, context }) => {
				const res = await tc(context.auth.revokeToken(input.refreshToken));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to log out",
					});
				}

				return { authenticated: false };
			}),

		session: p
			.route({
				method: "GET",
				path: "/api/auth/session",
			})
			.handler(async ({ context }) => {
				const principal = await authorize(context);
				return { authenticated: Boolean(principal), principal: principal ?? null };
			}),

		logout: p
			.route({
				method: "POST",
				path: "/api/auth/logout",
			})
			.handler(async ({ context }) => {
				const sessionToken = getCookie(context.reqHeaders, authSessionCookieName);
				const res = await tc(context.auth.logout(sessionToken));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to log out",
					});
				}

				deleteCookie(context.resHeaders, authSessionCookieName, { path: "/" });
				return { authenticated: false };
			}),

		listApiTokens: authenticated
			.route({
				method: "GET",
				path: "/api/auth/api-tokens",
			})
			.handler(async ({ context }) => {
				const res = await tc(context.auth.listApiTokens());
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to list API tokens",
					});
				}

				return { tokens: res.data };
			}),

		createApiToken: authenticated
			.route({
				method: "POST",
				path: "/api/auth/api-tokens",
			})
			.input(z.object({ name: z.string().trim().min(1) }))
			.handler(async ({ input, context }) => {
				const res = await tc(context.auth.createApiToken(input));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to create API token",
					});
				}

				return res.data;
			}),

		revokeApiToken: authenticated
			.route({
				method: "DELETE",
				path: "/api/auth/api-tokens/{id}",
			})
			.input(z.object({ id: z.string().min(1) }))
			.handler(async ({ input, context }) => {
				const res = await tc(context.auth.revokeApiToken(input.id));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to revoke API token",
					});
				}

				return { revoked: true };
			}),
	};
}

export async function requireAuth(context: HttpContext): Promise<void> {
	const principal = await authorize(context);
	if (principal) {
		return;
	}

	throw new ORPCError("UNAUTHORIZED");
}

async function authorize(context: HttpContext) {
	const bearerToken = requestBearerToken(context);
	const sessionToken = getCookie(context.reqHeaders, authSessionCookieName);
	const res = await tc(context.auth.authorize({ bearerToken, sessionToken }));
	if (res.error) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to authorize request",
		});
	}

	return res.data;
}

function requestBearerToken(context: HttpContext): string | undefined {
	const authorization = context.reqHeaders?.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) {
		return undefined;
	}

	const token = authorization.slice("Bearer ".length).trim();
	return token || undefined;
}

function setSessionCookie(context: HttpContext, session: RhoAuthSession): void {
	setCookie(context.resHeaders, authSessionCookieName, session.token, {
		expires: session.expiresAt,
		httpOnly: true,
		maxAge: session.maxAgeSeconds,
		path: "/",
		sameSite: "lax",
		secure: new URL(context.requestUrl).protocol === "https:",
	});
}
