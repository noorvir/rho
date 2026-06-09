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

export interface RhoProblemDetails {
	type: string;
	title: string;
	status: number;
	detail: string;
	code: string;
	action?: RhoErrorAction;
	details?: RhoErrorDetails;
}

const rhoErrorDefinitions: Record<RhoErrorCode, { orpcCode: ORPCErrorCode; message: string }> = {
	"auth.setup_required": {
		orpcCode: "CONFLICT",
		message: "Set up rho before logging in.",
	},
	"auth.setup_already_complete": {
		orpcCode: "CONFLICT",
		message: "rho is already set up. Log in with the password.",
	},
	"auth.invalid_owner_token": {
		orpcCode: "UNAUTHORIZED",
		message: "The root secret is incorrect.",
	},
	"auth.invalid_password": {
		orpcCode: "UNAUTHORIZED",
		message: "The password is incorrect.",
	},
	"auth.session_required": {
		orpcCode: "UNAUTHORIZED",
		message: "Log in to continue.",
	},
	"request.invalid": {
		orpcCode: "BAD_REQUEST",
		message: "Check the request and try again.",
	},
	"data.table_not_found": {
		orpcCode: "NOT_FOUND",
		message: "Table not found.",
	},
	"apps.api_not_found": {
		orpcCode: "NOT_FOUND",
		message: "App API not found.",
	},
	"apps.procedure_not_found": {
		orpcCode: "NOT_FOUND",
		message: "App procedure not found.",
	},
	"server.internal": {
		orpcCode: "INTERNAL_SERVER_ERROR",
		message: "rho could not complete the request. Try again.",
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

export function rhoErrorResponseBody(error: ORPCError<ORPCErrorCode, unknown>): RhoProblemDetails {
	if (isRhoErrorData(error.data)) {
		return {
			type: rhoProblemType(error.data.code),
			title: statusTitle(error.status),
			status: error.status,
			detail: error.data.message,
			code: error.data.code,
			action: error.data.action,
			details: error.data.details,
		};
	}

	return {
		type: rhoProblemType(error.code),
		title: statusTitle(error.status),
		status: error.status,
		detail: error.message,
		code: error.code,
	};
}

function rhoProblemType(code: string): string {
	return `https://rho.dev/errors/${code}`;
}

function statusTitle(status: number): string {
	if (status === 400) {
		return "Bad Request";
	}
	if (status === 401) {
		return "Unauthorized";
	}
	if (status === 404) {
		return "Not Found";
	}
	if (status === 409) {
		return "Conflict";
	}
	if (status >= 500) {
		return "Internal Server Error";
	}

	return "Error";
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
