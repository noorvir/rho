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

			const message = messageFromHttp(messageInput.data);
			const output = await tc(context.core.handleMessage(message));
			if (output.error) {
				throw badRequest(output.error, "Failed to handle message");
			}

			const collected = await tc(collectMessage(output.data));
			if (collected.error) {
				throw badRequest(collected.error, "Failed to handle message");
			}

			return { message: collected.data };
		}),

		handleMessageStream: p.agent.handleMessageStream.handler(async function* ({ input, context }) {
			await requireAuth(context);
			const messageInput = tc(() => validateHttpMessage(input));
			if (messageInput.error) {
				yield { type: "error" as const, error: errorMessage(messageInput.error) };
				return;
			}

			const message = messageFromHttp(messageInput.data);
			const output = await tc(context.core.handleMessage(message));
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

	for await (const message of output) {
		if (!started) {
			yield { type: "started" as const };
			started = true;
		}

		const delta = messageText(message);
		text += delta;
		yield { type: "delta" as const, text: delta };
	}

	if (!started) {
		yield { type: "error" as const, error: "Missing HTTP message" };
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
