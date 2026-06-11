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
				"Start a durable background task for work that takes more than about a minute. " +
				"The task runs after this reply ends and its outcome is delivered to the user automatically. " +
				"After calling this, finish your reply with a short acknowledgement and a rough time expectation.",
			promptSnippet: "Run long work as a background task; the user is notified when it finishes",
			promptGuidelines: [
				"For work that takes more than about a minute, call background_task, then reply with one or two plain-language sentences: what you'll do and roughly how long it takes. No technical steps or jargon. Do not do the long work in the conversation.",
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
 * Agent extension that registers the rho_reload tool, wired to the runtime's
 * extension reload. Returns a human-readable result summary to the model.
 */
export function rhoReloadExtension(reload: () => Promise<string>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_reload",
			label: "Reload Rho",
			description:
				"Reload the Rho runtime so newly created or edited extensions become visible in the user's apps. Call after creating or changing an extension.",
			promptSnippet: "Reload the Rho runtime to apply new or edited extensions",
			parameters: Type.Object({}),
			async execute() {
				const summary = await reload();
				return { content: [{ type: "text", text: summary }], details: undefined };
			},
		});
	};
}
