export { loadEnvWithNullishCheck } from "./env.ts";

export type Result<T> = { data: T; error: null } | { data: null; error: Error };

export function tc<T>(value: Promise<T>): Promise<Result<T>>;
export function tc<T>(value: () => Promise<T>): Promise<Result<T>>;
export function tc<T>(value: () => T): Result<T>;
export function tc<T>(value: Promise<T> | (() => T | Promise<T>)): Result<T> | Promise<Result<T>> {
	if (typeof value === "function") {
		try {
			const data = value();
			return isPromiseLike<T>(data) ? promiseResult(Promise.resolve(data)) : { data, error: null };
		} catch (error) {
			return { data: null, error: normalizeError(error) };
		}
	}

	return promiseResult(value);
}

export function wrapError(error: Error, message: string): Error {
	const fullMessage = error.message ? `${message}: ${error.message}` : message;

	try {
		error.message = fullMessage;
		return error;
	} catch {
		return new Error(fullMessage, { cause: error });
	}
}

async function promiseResult<T>(promise: Promise<T>): Promise<Result<T>> {
	return promise
		.then((data) => ({ data, error: null }) as Result<T>)
		.catch((error) => ({ data: null, error: normalizeError(error) }) as Result<T>);
}

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
	return (
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		"then" in value &&
		typeof (value as { then: unknown }).then === "function"
	);
}
