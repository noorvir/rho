import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export interface RhoContextOptions {
	/** Absolute directory containing the Rho docs. */
	docsDir: string;
}

/** Core doc pages bundled by rho_context, relative to the docs directory. */
export const RHO_CONTEXT_PAGES = [
	"index.md",
	"database.md",
	"extensions.md",
	"channels.md",
	"server.md",
] as const;

/**
 * Size budget for the bundled core docs, enforced by tests so doc growth is
 * caught at build time. The tool itself never throws or truncates at runtime;
 * an oversized result is handled by normal session compaction.
 */
export const RHO_CONTEXT_BUDGET_CHARS = 32_000;

/**
 * Agent extension that registers the rho_context tool: one call loads Rho's
 * core self-knowledge docs into the conversation as a single tool result.
 */
export function rhoContextExtension(options: RhoContextOptions): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_context",
			label: "Rho Context",
			description:
				"Load Rho's core docs (database, extensions, channels, server) as one result. " +
				"Call this once before working on anything that changes Rho — apps, extensions, " +
				"database schema, channels, or the server — unless its output is already in this conversation.",
			promptSnippet: "Load Rho's core docs in one call before changing anything about Rho itself",
			parameters: Type.Object({}),
			async execute() {
				const text = loadRhoContext(options.docsDir);
				return { content: [{ type: "text", text }], details: undefined };
			},
		});
	};
}

/** Reads and concatenates the core doc pages. */
export function loadRhoContext(docsDir: string): string {
	const sections = RHO_CONTEXT_PAGES.map((page) => {
		const text = readFileSync(join(docsDir, page), "utf8").trim();
		return `<!-- docs/${page} -->\n${text}`;
	});

	return sections.join("\n\n");
}
