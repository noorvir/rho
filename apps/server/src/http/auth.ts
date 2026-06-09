import { implement } from "@orpc/server";
import { deleteCookie, getCookie, setCookie } from "@orpc/server/helpers";
import { tc } from "@rho/lib";
import { authSessionCookieName, type RhoAuthSession } from "../auth.ts";
import { throwRhoError } from "../errors.ts";
import { httpContract } from "./contract.ts";
import type { HttpContext } from "./types.ts";

const p = implement(httpContract).$context<HttpContext>();

export function authRouter() {
	return {
		status: p.auth.status.handler(async ({ context }) => {
			const res = await tc(context.auth.setupRequired());
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to load auth setup status." });
			}

			return { setupRequired: res.data };
		}),

		setup: p.auth.setup.handler(async ({ input, context }) => {
			const res = await tc(context.auth.setup(input));
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to set up rho auth." });
			}

			const result = res.data;
			if (result.status === "already-complete") {
				throwRhoError("auth.setup_already_complete", {
					action: { kind: "open_login", label: "Go to login", href: new URL("/login", context.requestUrl).toString() },
				});
			}
			if (result.status === "unauthorized") {
				throwRhoError("auth.invalid_owner_token");
			}

			setSessionCookie(context, result.session);
			return { authenticated: true, principal: result.session.principal };
		}),

		login: p.auth.login.handler(async ({ input, context }) => {
			const setupRequired = await tc(context.auth.setupRequired());
			if (setupRequired.error) {
				throwRhoError("server.internal", { message: "Failed to load auth setup status." });
			}
			if (setupRequired.data) {
				throwSetupRequired(context.requestUrl);
			}

			const res = await tc(context.auth.login(input));
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to log in." });
			}

			const session = res.data;
			if (!session) {
				throwRhoError("auth.invalid_password");
			}

			setSessionCookie(context, session);
			return { authenticated: true, principal: session.principal };
		}),

		getToken: p.auth.getToken.handler(async ({ input, context }) => {
			const setupRequired = await tc(context.auth.setupRequired());
			if (setupRequired.error) {
				throwRhoError("server.internal", { message: "Failed to load auth setup status." });
			}
			if (setupRequired.data) {
				throwSetupRequired(context.requestUrl);
			}

			const res = await tc(context.auth.getToken(input));
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to log in." });
			}

			const tokens = res.data;
			if (!tokens) {
				throwRhoError("auth.invalid_password");
			}

			return tokens;
		}),

		refreshToken: p.auth.refreshToken.handler(async ({ input, context }) => {
			const res = await tc(context.auth.refreshToken(input.refreshToken));
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to refresh session." });
			}

			const tokens = res.data;
			if (!tokens) {
				throwRhoError("auth.session_required");
			}

			return tokens;
		}),

		revokeToken: p.auth.revokeToken.handler(async ({ input, context }) => {
			const res = await tc(context.auth.revokeToken(input.refreshToken));
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to log out." });
			}

			return { authenticated: false };
		}),

		session: p.auth.session.handler(async ({ context }) => {
			const principal = await authorize(context);
			return { authenticated: Boolean(principal), principal: principal ?? null };
		}),

		logout: p.auth.logout.handler(async ({ context }) => {
			const sessionToken = getCookie(context.reqHeaders, authSessionCookieName);
			const res = await tc(context.auth.logout(sessionToken));
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to log out." });
			}

			deleteCookie(context.resHeaders, authSessionCookieName, { path: "/" });
			return { authenticated: false };
		}),

		listApiTokens: p.auth.listApiTokens.handler(async ({ context }) => {
			await requireAuth(context);
			const res = await tc(context.auth.listApiTokens());
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to list API tokens." });
			}

			return { tokens: res.data };
		}),

		createApiToken: p.auth.createApiToken.handler(async ({ input, context }) => {
			await requireAuth(context);
			const res = await tc(context.auth.createApiToken(input));
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to create API token." });
			}

			return res.data;
		}),

		revokeApiToken: p.auth.revokeApiToken.handler(async ({ input, context }) => {
			await requireAuth(context);
			const res = await tc(context.auth.revokeApiToken(input.id));
			if (res.error) {
				throwRhoError("server.internal", { message: "Failed to revoke API token." });
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

	throwRhoError("auth.session_required");
}

async function authorize(context: HttpContext) {
	const bearerToken = requestBearerToken(context);
	const sessionToken = getCookie(context.reqHeaders, authSessionCookieName);
	const res = await tc(context.auth.authorize({ bearerToken, sessionToken }));
	if (res.error) {
		throwRhoError("server.internal", { message: "Failed to authorize request." });
	}

	return res.data;
}

function throwSetupRequired(requestUrl: string): never {
	const setupUrl = new URL("/setup", requestUrl).toString();
	throwRhoError("auth.setup_required", {
		action: { kind: "open_setup", label: "Go to setup", href: setupUrl },
	});
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
