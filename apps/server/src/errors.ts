import type { ORPCErrorCode } from "@orpc/client";
import { ORPCError } from "@orpc/server";

export type RhoErrorCode =
	| "auth.setup_required"
	| "auth.setup_already_complete"
	| "auth.invalid_owner_token"
	| "auth.invalid_password"
	| "auth.session_required"
	| "request.invalid"
	| "data.table_not_found"
	| "apps.api_not_found"
	| "apps.procedure_not_found"
	| "server.internal";

export type RhoErrorAction =
	| { kind: "open_setup"; label: string; href: string }
	| { kind: "open_login"; label: string; href: string }
	| { kind: "retry"; label: string };

export type RhoErrorDetail = string | number | boolean | null;
export type RhoErrorDetails = Record<string, RhoErrorDetail>;

export interface RhoErrorData {
	code: RhoErrorCode;
	message: string;
	action?: RhoErrorAction;
	details?: RhoErrorDetails;
}

export interface RhoErrorOptions {
	message?: string;
	action?: RhoErrorAction;
	details?: RhoErrorDetails;
}

export interface RhoErrorResponseBody {
	error: RhoErrorData | { code: string; message: string };
}

const rhoErrorDefinitions: Record<RhoErrorCode, { orpcCode: ORPCErrorCode; message: string }> = {
	"auth.setup_required": {
		orpcCode: "CONFLICT",
		message: "This rho deployment has not been set up yet. Claim it with the owner token before logging in.",
	},
	"auth.setup_already_complete": {
		orpcCode: "CONFLICT",
		message: "This rho deployment has already been set up. Log in with the owner password.",
	},
	"auth.invalid_owner_token": {
		orpcCode: "UNAUTHORIZED",
		message: "The owner token is incorrect. Use the RHO_OWNER_TOKEN configured for this server.",
	},
	"auth.invalid_password": {
		orpcCode: "UNAUTHORIZED",
		message: "The owner password is incorrect.",
	},
	"auth.session_required": {
		orpcCode: "UNAUTHORIZED",
		message: "Log in to rho before continuing.",
	},
	"request.invalid": {
		orpcCode: "BAD_REQUEST",
		message: "rho could not understand the request. Check the request and try again.",
	},
	"data.table_not_found": {
		orpcCode: "NOT_FOUND",
		message: "rho could not find that table.",
	},
	"apps.api_not_found": {
		orpcCode: "NOT_FOUND",
		message: "rho could not find that app API.",
	},
	"apps.procedure_not_found": {
		orpcCode: "NOT_FOUND",
		message: "rho could not find that app procedure.",
	},
	"server.internal": {
		orpcCode: "INTERNAL_SERVER_ERROR",
		message: "rho could not complete the request. Try again, or check the server logs if the problem continues.",
	},
};

export function rhoError(code: RhoErrorCode, options: RhoErrorOptions = {}) {
	const definition = rhoErrorDefinitions[code];
	const message = options.message ?? definition.message;

	return new ORPCError(definition.orpcCode, {
		message,
		data: {
			code,
			message,
			action: options.action,
			details: options.details,
		},
	});
}

export function throwRhoError(code: RhoErrorCode, options?: RhoErrorOptions): never {
	throw rhoError(code, options);
}

export function rhoErrorResponseBody(error: ORPCError<ORPCErrorCode, unknown>): RhoErrorResponseBody {
	if (isRhoErrorData(error.data)) {
		return { error: error.data };
	}

	return {
		error: {
			code: error.code,
			message: error.message,
		},
	};
}

function isRhoErrorData(data: unknown): data is RhoErrorData {
	return (
		data !== null &&
		typeof data === "object" &&
		"code" in data &&
		typeof data.code === "string" &&
		"message" in data &&
		typeof data.message === "string"
	);
}
