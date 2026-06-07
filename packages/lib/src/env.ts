export function loadEnvWithNullishCheck(varName: string, required = true, defaultValue?: string): string {
	const raw = process.env[varName];
	const value = raw !== undefined && raw !== "" ? raw : undefined;

	if (value !== undefined) {
		return value;
	}
	if (defaultValue !== undefined) {
		return defaultValue;
	}
	if ("window" in globalThis) {
		return "";
	}
	if (required) {
		throw new Error(`Missing or empty required env var: ${varName}`);
	}

	return "";
}
