import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export interface BackgroundTaskRequest {
	title: string;
	instructions: string;
}

const backgroundTaskParams = Type.Object({
	title: Type.String({ description: "Short user-facing name for the task, e.g. 'Build the todo list app'" }),
	instructions: Type.String({
		description:
			"Complete instructions for the worker agent: what to build or change, relevant context from this conversation, and what the outcome should be. The worker cannot see this conversation.",
	}),
});

/**
 * Agent extension that registers the background_task tool. The provided
 * callback creates the durable task and returns its id; the runtime runs the
 * task and delivers the outcome to the conversation when it finishes.
 */
export function backgroundTaskExtension(
	start: (request: BackgroundTaskRequest) => Promise<{ taskId: string }>,
): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "background_task",
			label: "Background Task",
			description:
				"Delegate implementation work to a background agent with full tools. This is the only way to build or change anything from a conversation — apps, extensions, files, schema, installs — and the right way to run any work over about a minute. Never refuse buildable requests because this conversation lacks write tools; delegate them here instead. " +
				"The task runs after this reply ends and its outcome is delivered to the user automatically. " +
				"After calling this, finish your reply with a short acknowledgement and a rough time expectation.",
			promptSnippet:
				"Delegate building/changing anything (and other long work) to a background task; the user is notified when it finishes",
			promptGuidelines: [
				"To build or change anything, or for work over about a minute, call background_task, then reply with one or two plain-language sentences: what you'll do and roughly how long it takes. No technical steps or jargon. Do not attempt the work in the conversation and do not refuse because this conversation lacks write tools.",
			],
			parameters: backgroundTaskParams,
			async execute(_toolCallId, params) {
				const result = await start({ title: params.title, instructions: params.instructions });
				return {
					content: [
						{
							type: "text",
							text: `Background task ${result.taskId} started. Reply to the user with a short acknowledgement now; the outcome will be delivered to them automatically when the task finishes.`,
						},
					],
					details: result,
				};
			},
		});
	};
}

/**
 * Agent extension that registers the rho_query tool: read-only SQL against
 * the shared runtime database, for answering questions about the user's data
 * in realtime channel turns. The connection is opened read-only, so writes
 * are impossible regardless of the SQL submitted.
 */
export function rhoQueryExtension(query: (sql: string) => Promise<string>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_query",
			label: "Query Rho data",
			description:
				"Run a read-only SQL query (SQLite) against the user's shared database to answer questions about their data. Writes are impossible on this connection — use a background task for changes.",
			promptSnippet: "Read-only SQL over the user's data; use for data questions in conversation",
			parameters: Type.Object({
				sql: Type.String({ description: "A single SELECT (or PRAGMA) statement." }),
			}),
			async execute(_toolCallId, params) {
				const rows = await query(params.sql);
				return { content: [{ type: "text", text: rows }], details: undefined };
			},
		});
	};
}

/**
 * Agent extension that registers the rho_migrate tool, wired to the runtime's
 * safe schema-migration flow (validate on a copy, apply live, regenerate,
 * reload). Returns a human-readable result summary to the model.
 */
export function rhoMigrateExtension(migrate: (name: string) => Promise<string>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_migrate",
			label: "Migrate Rho schema",
			description:
				"Apply a runtime database schema change safely after editing the runtime schema.prisma: validates the migration on a copy of the live database, applies it live, regenerates the client, and reloads the runtime so new models are usable immediately. Use this instead of running prisma commands manually. Never edit or remove rho_sys_* models.",
			promptSnippet: "Safely migrate the Rho database after editing the runtime schema",
			parameters: Type.Object({
				name: Type.String({ description: "Short snake_case migration name, e.g. add_books" }),
			}),
			async execute(_toolCallId, params) {
				const summary = await migrate(params.name);
				return { content: [{ type: "text", text: summary }], details: undefined };
			},
		});
	};
}

/**
 * Agent extension that registers the rho_reload tool, wired to the runtime's
 * extension reload. Returns a human-readable result summary to the model.
 */
export function rhoReloadExtension(reload: () => Promise<string>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_reload",
			label: "Reload Rho",
			description:
				"Reload the Rho runtime so newly created or edited extensions become visible in the user's apps, and swap in the regenerated database client after schema changes. Call after creating or changing an extension or running a migration. Never restart the rho server instead — it hosts this session.",
			promptSnippet: "Reload the Rho runtime to apply new or edited extensions and schema changes",
			parameters: Type.Object({}),
			async execute() {
				const summary = await reload();
				return { content: [{ type: "text", text: summary }], details: undefined };
			},
		});
	};
}
