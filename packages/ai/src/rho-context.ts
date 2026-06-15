import { readFileSync, readdirSync, statSync } from "node:fs";
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
		const path = join(docsDir, page);
		const text = readFileSync(path, "utf8").trim();
		return `<!-- ${path} -->\n${text}`;
	});

	return [...sections, docsIndex(docsDir)].join("\n\n");
}

function docsIndex(docsDir: string): string {
	const entries = listMarkdownFiles(docsDir).map((path) => {
		const text = readFileSync(path, "utf8");
		const frontmatter = readFrontmatter(text);
		if (!frontmatter) {
			return path;
		}

		const metadata = frontmatter
			.split("\n")
			.map((line) => `  ${line}`)
			.join("\n");
		return `${path}\n${metadata}`;
	});

	return `## Available Rho docs\n\nUse this index to choose and read additional docs when the loaded context is not enough.\n\n${entries.join("\n\n")}`;
}

function listMarkdownFiles(directory: string): string[] {
	const paths: string[] = [];
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) {
			paths.push(...listMarkdownFiles(path));
		} else if (entry.endsWith(".md")) {
			paths.push(path);
		}
	}
	return paths.sort();
}

function readFrontmatter(text: string): string | undefined {
	if (!text.startsWith("---\n")) {
		return undefined;
	}

	const end = text.indexOf("\n---", 4);
	if (end < 0) {
		return undefined;
	}
	return text.slice(4, end).trim();
}
