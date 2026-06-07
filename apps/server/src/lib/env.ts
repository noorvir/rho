import { loadEnvWithNullishCheck } from "@rho/lib";

export const env = {
	port: Number(loadEnvWithNullishCheck("RHO_PORT", false, "7331")),
	apiSecret: loadEnvWithNullishCheck("RHO_API_SECRET"),
	extensionPaths: splitPaths(loadEnvWithNullishCheck("RHO_EXTENSION_PATHS", false)),
};

function splitPaths(value: string): string[] {
	return value
		.split(":")
		.map((path) => path.trim())
		.filter(Boolean);
}
