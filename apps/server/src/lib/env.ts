import { loadEnvWithNullishCheck } from "@rho/lib";

const RHO_PORT = Number(loadEnvWithNullishCheck("RHO_PORT", false, "7331"));

export const env = {
	RHO_PORT,
	RHO_DATABASE_URL: loadEnvWithNullishCheck("RHO_DATABASE_URL"),
	RHO_OWNER_TOKEN: loadEnvWithNullishCheck("RHO_OWNER_TOKEN"),
	RHO_EXTENSION_PATHS: splitPaths(loadEnvWithNullishCheck("RHO_EXTENSION_PATHS", false)),
};

function splitPaths(value: string): string[] {
	return value
		.split(":")
		.map((path) => path.trim())
		.filter(Boolean);
}
