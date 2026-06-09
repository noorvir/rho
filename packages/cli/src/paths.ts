import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "./env.ts";

export function getDefaultAgentDir(): string {
	return env.RHO_AGENT_DIR || join(homedir(), ".rho", "agent");
}
