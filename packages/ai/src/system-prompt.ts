import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Rho owns the full base system prompt on every agent surface (terminal,
 * one-shot CLI, channel conversations). It replaces the underlying engine's
 * default prompt, so it carries its own identity, tool, and guideline text;
 * the engine still appends project context files, skills, date, and working
 * directory.
 *
 * The static base lists only the engine's default tools. rhoSystemPromptExtension
 * rebuilds the tool and guideline sections per turn from the live session
 * options, so tools and guideline bullets contributed by installed extensions
 * keep appearing in the prompt exactly as they would with the engine default.
 */
export function getRhoSystemPrompt(): string {
	return buildRhoPrompt(defaultToolsSection(), guidelinesSection(DEFAULT_GUIDELINES));
}

/** Engine extension keeping Rho's prompt sections in sync with live session tools. */
export function rhoSystemPromptExtension(pi: ExtensionAPI): void {
	pi.on("before_agent_start", (event) => {
		const options = event.systemPromptOptions;
		const staticTools = defaultToolsSection();
		const staticGuidelines = guidelinesSection(DEFAULT_GUIDELINES);

		let prompt = event.systemPrompt;
		prompt = replaceSection(prompt, staticTools, toolsSectionFromOptions(options));
		prompt = replaceSection(prompt, staticGuidelines, guidelinesSectionFromOptions(options));

		if (prompt === event.systemPrompt) {
			return;
		}
		return { systemPrompt: prompt };
	});
}

// Default engine tools with their upstream one-line prompt snippets.
const DEFAULT_TOOL_SNIPPETS: Record<string, string> = {
	read: "Read file contents",
	bash: "Execute bash commands (ls, grep, find, etc.)",
	edit: "Make precise file edits with exact text replacement, including multiple disjoint edits in one call",
	write: "Create or overwrite files",
};

const DEFAULT_TOOLS = ["read", "bash", "edit", "write"];

const DEFAULT_GUIDELINES = [
	"Use bash for file operations like ls, rg, find",
	"Be concise in your responses",
	"Show file paths clearly when working with files",
];

function buildRhoPrompt(toolsSection: string, guidelinesSection: string): string {
	const piDir = getPiPackageDir();
	const readmePath = join(piDir, "README.md");
	const docsPath = join(piDir, "docs");
	const examplesPath = join(piDir, "examples");

	return `You are the Rho agent, an extensible personal assistant that helps users get things done. You are strong at coding, terminal work, web research, files, installs, and extending Rho itself, but your main job is to understand the user's goal and help complete it.

Users may reach you from the terminal, WhatsApp, Telegram, installer flows, or other channels. Use any channel context you are given, adapt your responses to that surface, and explain when a task needs an extension or a different capability.

${toolsSection}

In addition to the tools above, you may have access to other tools provided by the runtime and installed extensions. Help users understand that Rho can grow by installing and using extensions when the built-in capabilities are not enough.

${guidelinesSection}

Rho runtime:
- Before changing Rho internals, extension behavior, app behavior, database behavior, filesystem conventions, install behavior, or security behavior, read docs/index.md and then the relevant Rho docs in the documented order.
- When helping users build Rho apps or extensions, use the Todo app as the running example unless the user asks for another domain. Prefer typed oRPC and React Query for normal app API calls. Treat rho.apiFetch() as a lower-level escape hatch.
- For install decisions, ask normal users product-level questions with a recommended default. Do not ask schema/table/field questions unless the user chooses customization.
- The installed runtime owns db/schema.prisma, db/rho.sqlite, and db/generated/. Schema changes should go through approved Rho-managed Prisma migrations.

Underlying agent:
Rho is built on the pi coding agent. Sessions, tools, extensions, skills, prompt templates, themes, and packages come from pi and work in Rho unchanged. Present yourself as Rho in user-facing responses, and credit pi factually when the underlying agent itself is the topic.

When the user asks about underlying agent capabilities — extensions, skills, prompt templates, themes, packages, keybindings, custom providers, or models — read the pi documentation installed locally:
- Main documentation: ${readmePath}
- Additional docs: ${docsPath}
- Examples: ${examplesPath} (extensions, custom tools, SDK)
- Resolve docs/... under Additional docs and examples/... under Examples, not the current working directory.
- Topics: extensions (docs/extensions.md, examples/extensions/), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), themes (docs/themes.md), packages (docs/packages.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), models (docs/models.md).
- Read pi .md files completely and follow links to related docs before implementing.
- Pi docs reference the pi CLI; in Rho the same commands run under the rho binary (for example pi install <source> is rho install <source>).`;
}

function defaultToolsSection(): string {
	const entries = DEFAULT_TOOLS.map((name) => ({ name, snippet: DEFAULT_TOOL_SNIPPETS[name] }));
	return toolsSection(entries);
}

function toolsSection(entries: Array<{ name: string; snippet: string }>): string {
	const list =
		entries.length > 0 ? entries.map((entry) => `- ${entry.name}: ${entry.snippet}`).join("\n") : "(none)";
	return `Available tools:\n${list}`;
}

function toolsSectionFromOptions(options: BuildSystemPromptOptions): string {
	const tools = options.selectedTools ?? DEFAULT_TOOLS;
	const snippets = options.toolSnippets ?? DEFAULT_TOOL_SNIPPETS;
	const entries: Array<{ name: string; snippet: string }> = [];

	for (const name of tools) {
		const snippet = snippets[name];
		if (snippet) {
			entries.push({ name, snippet });
		}
	}

	return toolsSection(entries);
}

function guidelinesSection(guidelines: string[]): string {
	return `Guidelines:\n${guidelines.map((guideline) => `- ${guideline}`).join("\n")}`;
}

// Mirrors the engine's default guideline assembly: the bash file-operations
// bullet when bash stands in for ls/grep/find, then tool-contributed bullets,
// then the always-on bullets, deduplicated in order.
function guidelinesSectionFromOptions(options: BuildSystemPromptOptions): string {
	const tools = options.selectedTools ?? DEFAULT_TOOLS;
	const guidelines: string[] = [];
	const seen = new Set<string>();
	const add = (guideline: string) => {
		const normalized = guideline.trim();
		if (!normalized || seen.has(normalized)) {
			return;
		}
		seen.add(normalized);
		guidelines.push(normalized);
	};

	const hasBashOnly =
		tools.includes("bash") && !tools.includes("grep") && !tools.includes("find") && !tools.includes("ls");
	if (hasBashOnly) {
		add("Use bash for file operations like ls, rg, find");
	}
	for (const guideline of options.promptGuidelines ?? []) {
		add(guideline);
	}
	add("Be concise in your responses");
	add("Show file paths clearly when working with files");

	return guidelinesSection(guidelines);
}

// String#replace treats $ in the replacement specially; a function replacer
// inserts the section verbatim.
function replaceSection(prompt: string, current: string, next: string): string {
	if (current === next) {
		return prompt;
	}
	return prompt.replace(current, () => next);
}

function getPiPackageDir(): string {
	const entry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
	// <package>/dist/index.js -> <package>
	return dirname(dirname(entry));
}
