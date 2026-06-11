import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnvWithNullishCheck } from "@rho/lib";

const defaultAgentDir = join(homedir(), ".rho", "agent");

const RHO_PORT = Number(loadEnvWithNullishCheck("RHO_PORT", false, process.env.PORT ?? "7331"));
const RHO_AGENT_DIR = resolve(loadEnvWithNullishCheck("RHO_AGENT_DIR", false, defaultAgentDir));
const stateDir = loadEnvWithNullishCheck("RHO_STATE_DIR", false);
const RHO_STATE_DIR = stateDir ? resolve(stateDir) : undefined;

export const env = {
	RHO_PORT,
	RHO_AGENT_DIR,
	RHO_STATE_DIR,
	RHO_DATABASE_URL: loadEnvWithNullishCheck("RHO_DATABASE_URL"),
	RHO_OWNER_TOKEN: loadEnvWithNullishCheck("RHO_OWNER_TOKEN"),
	RHO_EXTENSION_PATHS: splitPaths(loadEnvWithNullishCheck("RHO_EXTENSION_PATHS", false)),
};

function splitPaths(value: string): string[] {
	return value
		.split(":")
		.map((path) => path.trim())
		.filter(Boolean)
		.map((path) => resolve(path));
}
