import { loadEnvWithNullishCheck } from "@rho/lib";

export const env = {
	RHO_AGENT_DIR: loadEnvWithNullishCheck("RHO_AGENT_DIR", false),
};
