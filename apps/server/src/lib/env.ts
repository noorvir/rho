import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvWithNullishCheck } from "@rho/lib";

// All runtime-mutable state lives under the rho home directory; individual
// RHO_* variables override the derived defaults for special setups.
const RHO_HOME = resolve(loadEnvWithNullishCheck("RHO_HOME", false, join(homedir(), ".rho")));
const homeDbDir = join(RHO_HOME, "db");
const generatedClientDir = join(homeDbDir, "generated", "prisma");

const RHO_PORT = Number(loadEnvWithNullishCheck("RHO_PORT", false, process.env.PORT ?? "7331"));
const RHO_AGENT_DIR = resolve(loadEnvWithNullishCheck("RHO_AGENT_DIR", false, join(RHO_HOME, "agent")));
const RHO_STATE_DIR = resolve(loadEnvWithNullishCheck("RHO_STATE_DIR", false, join(RHO_HOME, "state")));
const RHO_STORE_DIR = resolve(loadEnvWithNullishCheck("RHO_STORE_DIR", false, join(RHO_HOME, "store")));
const RHO_DOCS_DIR = resolve(loadEnvWithNullishCheck("RHO_DOCS_DIR", false, defaultDocsDir()));

export const env = {
	RHO_HOME,
	RHO_PORT,
	RHO_AGENT_DIR,
	RHO_STATE_DIR,
	RHO_STORE_DIR,
	RHO_DOCS_DIR,
	RHO_DATABASE_URL: loadEnvWithNullishCheck(
		"RHO_DATABASE_URL",
		false,
		`file:${join(homeDbDir, "rho.sqlite")}`,
	),
	RHO_OWNER_TOKEN: loadEnvWithNullishCheck("RHO_OWNER_TOKEN"),
	RHO_EXTENSION_PATHS: splitPaths(loadEnvWithNullishCheck("RHO_EXTENSION_PATHS", false)),
	/** Home extensions workspace; loaded alongside RHO_EXTENSION_PATHS. */
	RHO_EXTENSIONS_DIR: join(RHO_HOME, "extensions"),
	/** Runtime-generated Prisma client dir, when the home db has been initialized. */
	RHO_GENERATED_CLIENT_DIR: existsSync(generatedClientDir) ? generatedClientDir : undefined,
	/** Runtime db dir, when the home db has been initialized; enables rho_migrate. */
	RHO_DB_DIR: existsSync(join(homeDbDir, "schema.prisma")) ? homeDbDir : undefined,
	RHO_TASK_THINKING_LEVEL: taskThinkingLevel(),
	RHO_TASK_MODEL: taskModel(),
	/** Channel chat model override; defaults to the agent settings model when unset. */
	RHO_CHANNEL_MODEL: providerModel("RHO_CHANNEL_MODEL"),
	/** Channel chat reasoning effort; the channel itself defaults to minimal when unset. */
	RHO_CHANNEL_THINKING_LEVEL: thinkingLevel("RHO_CHANNEL_THINKING_LEVEL"),
};

function taskModel(): { provider: string; modelId: string } | undefined {
	return providerModel("RHO_TASK_MODEL");
}

/** Parses `provider/modelId`, for example `openai-codex/gpt-5.5`. */
function providerModel(name: string): { provider: string; modelId: string } | undefined {
	const value = loadEnvWithNullishCheck(name, false);
	if (!value) {
		return undefined;
	}
	const separator = value.indexOf("/");
	if (separator <= 0 || separator === value.length - 1) {
		throw new Error(`${name} must be "provider/modelId", got: ${value}`);
	}
	return { provider: value.slice(0, separator), modelId: value.slice(separator + 1) };
}

function taskThinkingLevel(): "minimal" | "low" | "medium" | "high" | undefined {
	return thinkingLevel("RHO_TASK_THINKING_LEVEL");
}

function thinkingLevel(name: string): "minimal" | "low" | "medium" | "high" | undefined {
	const value = loadEnvWithNullishCheck(name, false);
	if (value === "minimal" || value === "low" || value === "medium" || value === "high") {
		return value;
	}
	return undefined;
}

function defaultDocsDir(): string {
	const packagedDocsDir = fileURLToPath(new URL("../docs/", import.meta.url));
	if (existsSync(packagedDocsDir)) {
		return packagedDocsDir;
	}

	return fileURLToPath(new URL("../../../../docs/", import.meta.url));
}

function splitPaths(value: string): string[] {
	return value
		.split(":")
		.map((path) => path.trim())
		.filter(Boolean)
		.map((path) => resolve(path));
}
