import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { env } from "./env.ts";

export function getDefaultAgentDir(): string {
	return resolve(env.RHO_AGENT_DIR || join(homedir(), ".rho", "agent"));
}
