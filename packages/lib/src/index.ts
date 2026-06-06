export type Result<T> = { data: T; error: null } | { data: null; error: Error };

export async function tc<T>(promise: Promise<T>): Promise<Result<T>> {
	try {
		const data = await promise;
		return { data, error: null };
	} catch (error) {
		return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
	}
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
