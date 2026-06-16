import { implement } from "@orpc/server";
import { type ChannelMessage, type ChannelOutput, messageText } from "@rho/channels";
import { tc } from "@rho/lib";
import { throwRhoError } from "../errors.ts";
import { conversationKey, messageFromHttp, validateHttpMessage } from "../http-message.ts";
import { requireAuth } from "./auth.ts";
import { httpContract } from "./contract.ts";
import type { HttpContext } from "./types.ts";

const p = implement(httpContract).$context<HttpContext>();

export function agentRouter() {
	return {
		messages: p.agent.messages.handler(async ({ input, context }) => {
			await requireAuth(context);
			const key = conversationKey(input.id);
			const res = await tc(context.core.loadConversation(key));
			if (res.error) {
				throw badRequest(res.error, "Failed to load messages");
			}

			return res.data;
		}),

		handleMessage: p.agent.handleMessage.handler(async ({ input, context }) => {
			await requireAuth(context);
			const messageInput = tc(() => validateHttpMessage(input));
			if (messageInput.error) {
				throw badRequest(messageInput.error, "Failed to handle message");
			}

			const message = tc(() => messageFromHttp(messageInput.data, context.store));
			if (message.error) {
				throw badRequest(message.error, "Failed to handle message");
			}

			const output = await tc(context.core.handleMessage(message.data));
			if (output.error) {
				throw badRequest(output.error, "Failed to handle message");
			}

			const collected = await tc(collectMessage(output.data));
			if (collected.error) {
				throw badRequest(collected.error, "Failed to handle message");
			}

			return { message: collected.data };
		}),

		tasks: p.agent.tasks.handler(async ({ input, context }) => {
			await requireAuth(context);
			const key = conversationKey(input.id);
			const res = await tc(context.core.listTasks(key));
			if (res.error) {
				throw badRequest(res.error, "Failed to load tasks");
			}

			const tasks = res.data.map((task) => ({
				id: task.id,
				title: task.title,
				status: task.status,
				summary: task.summary,
				error: task.error,
				createdAt: task.createdAt,
				updatedAt: task.updatedAt,
			}));

			return { tasks };
		}),

		crons: p.agent.crons.handler(async ({ context }) => {
			await requireAuth(context);
			const crons = await tc(context.core.listCrons("all"));
			if (crons.error) {
				throw badRequest(crons.error, "Failed to load crons");
			}

			return { crons: crons.data };
		}),

		reminders: p.agent.reminders.handler(async ({ context }) => {
			await requireAuth(context);
			const reminders = await tc(context.core.listReminders());
			if (reminders.error) {
				throw badRequest(reminders.error, "Failed to load reminders");
			}

			return { reminders: reminders.data };
		}),

		notifications: p.agent.notifications.handler(async ({ context }) => {
			await requireAuth(context);
			const notifications = await tc(context.core.listNotifications());
			if (notifications.error) {
				throw badRequest(notifications.error, "Failed to load notifications");
			}

			return { notifications: notifications.data };
		}),

		handleMessageStream: p.agent.handleMessageStream.handler(async function* ({ input, context }) {
			await requireAuth(context);
			const messageInput = tc(() => validateHttpMessage(input));
			if (messageInput.error) {
				yield { type: "error" as const, error: errorMessage(messageInput.error) };
				return;
			}

			const message = tc(() => messageFromHttp(messageInput.data, context.store));
			if (message.error) {
				yield { type: "error" as const, error: errorMessage(message.error) };
				return;
			}

			const output = await tc(context.core.handleMessage(message.data));
			if (output.error) {
				yield { type: "error" as const, error: errorMessage(output.error) };
				return;
			}

			yield* streamOutput(output.data);
		}),
	};
}

async function* streamOutput(output: ChannelOutput) {
	if (!isMessageStream(output)) {
		const text = messageText(output);
		yield { type: "started" as const };
		yield { type: "delta" as const, text };
		yield { type: "completed" as const, text };
		return;
	}

	let text = "";
	let started = false;

	try {
		for await (const message of output) {
			if (!started) {
				yield { type: "started" as const };
				started = true;
			}

			const delta = messageText(message);
			text += delta;
			yield { type: "delta" as const, text: delta };
		}
	} catch (error) {
		console.error("agent turn failed:", error);
		yield { type: "error" as const, error: errorMessage(error) };
		return;
	}

	if (!started) {
		yield {
			type: "error" as const,
			error:
				"The Rho agent did not produce a response. Check the deployed agent provider, model, and auth configuration.",
		};
		return;
	}

	yield { type: "completed" as const, text };
}

async function collectMessage(output: ChannelOutput): Promise<ChannelMessage> {
	if (!isMessageStream(output)) {
		return output;
	}

	let firstMessage: ChannelMessage | undefined;
	let lastMessage: ChannelMessage | undefined;
	let text = "";

	for await (const message of output) {
		firstMessage ??= message;
		lastMessage = message;
		text += messageText(message);
	}

	if (!firstMessage || !lastMessage) {
		throw new Error("Agent did not produce a response");
	}

	return {
		...lastMessage,
		content: [{ type: "text", text }],
		replyTo: firstMessage.replyTo,
	};
}

function isMessageStream(output: ChannelOutput): output is AsyncIterable<ChannelMessage> {
	return Symbol.asyncIterator in output;
}

function badRequest(error: unknown, fallback: string): never {
	throwRhoError("request.invalid", { message: errorMessage(error, fallback) });
}

function errorMessage(error: unknown, fallback?: string): string {
	const message = error instanceof Error ? error.message : "Unknown error";
	return fallback ? `${fallback}: ${message}` : message;
}
