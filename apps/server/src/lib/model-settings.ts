import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Runtime-selectable chat/task models. Persisted to a JSON file in the agent
 * directory and read per turn by the core resolver, so changing a model from
 * the app applies immediately without a server restart.
 */

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export interface ModelChoice {
	provider: string;
	modelId: string;
	label: string;
}

/** Curated set the app offers; each must be backed by the agent's auth. */
export const modelChoices: ModelChoice[] = [
	{ provider: "cerebras", modelId: "zai-glm-4.7", label: "GLM-4.7 — Cerebras (fast)" },
	{ provider: "cerebras", modelId: "gpt-oss-120b", label: "GPT-OSS 120B — Cerebras (fast)" },
	{ provider: "openai-codex", modelId: "gpt-5.5", label: "GPT-5.5 — Codex" },
];

export const thinkingLevels: ThinkingLevel[] = ["minimal", "low", "medium", "high"];

/** Common IANA zones offered in the app; the server's own zone is always added. */
export const commonTimezones: string[] = [
	"Europe/London",
	"Europe/Berlin",
	"Europe/Paris",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"Asia/Kolkata",
	"Asia/Dubai",
	"Asia/Singapore",
	"Asia/Tokyo",
	"Australia/Sydney",
	"UTC",
];

export function systemTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Curated zone list with the system zone first and de-duplicated. */
export function timezoneChoices(current: string): string[] {
	const ordered = [systemTimezone(), current, ...commonTimezones];
	return [...new Set(ordered.filter(Boolean))];
}

export interface RoleSelection {
	provider: string;
	modelId: string;
	thinking: ThinkingLevel;
}

export interface ModelSettings {
	chat: RoleSelection;
	task: RoleSelection;
	/** IANA time zone the agent and reminders use as "local". */
	timezone: string;
}

const defaultRoles = {
	chat: { provider: "cerebras", modelId: "zai-glm-4.7", thinking: "minimal" as ThinkingLevel },
	task: { provider: "cerebras", modelId: "zai-glm-4.7", thinking: "low" as ThinkingLevel },
};

function settingsPath(agentDir: string): string {
	return join(agentDir, "rho-model-settings.json");
}

function normalizeRole(value: unknown, fallback: RoleSelection): RoleSelection {
	if (typeof value !== "object" || value === null) {
		return fallback;
	}
	const role = value as Partial<RoleSelection>;
	const thinking = thinkingLevels.includes(role.thinking as ThinkingLevel)
		? (role.thinking as ThinkingLevel)
		: fallback.thinking;
	return {
		provider: typeof role.provider === "string" ? role.provider : fallback.provider,
		modelId: typeof role.modelId === "string" ? role.modelId : fallback.modelId,
		thinking,
	};
}

export function readModelSettings(agentDir: string): ModelSettings {
	try {
		const path = settingsPath(agentDir);
		if (existsSync(path)) {
			const raw = JSON.parse(readFileSync(path, "utf8")) as {
				chat?: unknown;
				task?: unknown;
				timezone?: unknown;
			};
			return {
				chat: normalizeRole(raw.chat, defaultRoles.chat),
				task: normalizeRole(raw.task, defaultRoles.task),
				timezone: typeof raw.timezone === "string" && raw.timezone ? raw.timezone : systemTimezone(),
			};
		}
	} catch (error) {
		console.error("failed to read model settings:", error);
	}
	return { chat: defaultRoles.chat, task: defaultRoles.task, timezone: systemTimezone() };
}

export function writeModelSettings(agentDir: string, next: ModelSettings): ModelSettings {
	const value: ModelSettings = {
		chat: normalizeRole(next.chat, defaultRoles.chat),
		task: normalizeRole(next.task, defaultRoles.task),
		timezone: typeof next.timezone === "string" && next.timezone ? next.timezone : systemTimezone(),
	};
	writeFileSync(settingsPath(agentDir), `${JSON.stringify(value, null, 2)}\n`);
	return value;
}

export function resolveTimezone(agentDir: string): () => string {
	return () => readModelSettings(agentDir).timezone;
}

/** Resolver passed to the core: maps the persisted file to agent model selections. */
export function agentModelsResolver(agentDir: string): () => {
	channel: { model: { provider: string; modelId: string }; thinkingLevel: ThinkingLevel };
	task: { model: { provider: string; modelId: string }; thinkingLevel: ThinkingLevel };
} {
	return () => {
		const settings = readModelSettings(agentDir);
		return {
			channel: {
				model: { provider: settings.chat.provider, modelId: settings.chat.modelId },
				thinkingLevel: settings.chat.thinking,
			},
			task: {
				model: { provider: settings.task.provider, modelId: settings.task.modelId },
				thinkingLevel: settings.task.thinking,
			},
		};
	};
}
