import { ORPCError, os } from "@orpc/server";
import {
	type ChannelMessage,
	type ChannelOutput,
	HttpChannel,
	messageText,
	type SseStream,
} from "@rho/channels";
import { tc } from "@rho/lib";
import * as z from "zod";
import { conversationKey, messageFromHttp, validateHttpMessage } from "../http-message.ts";
import { requireAuth } from "./auth.ts";
import type { HttpContext } from "./types.ts";

const p = os.$context<HttpContext>();
const authenticated = p.use(async ({ context, next }) => {
	await requireAuth(context);
	return next();
});

export function agentRouter() {
	return {
		messages: authenticated
			.route({
				method: "GET",
				path: "/agent/conversations/{id}/messages",
			})
			.input(
				z.object({
					id: z.string().min(1),
				}),
			)
			.handler(async ({ input, context }) => {
				const key = conversationKey(input.id);
				const res = await tc(context.core.loadConversation(key));
				if (res.error) {
					throw badRequest(res.error, "Failed to load messages");
				}

				return res.data;
			}),

		handleMessage: authenticated
			.route({
				method: "POST",
				path: "/agent/messages",
			})
			.input(messageInputSchema())
			.handler(async ({ input, context }) => {
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

		handleMessageStream: authenticated
			.route({
				method: "POST",
				path: "/agent/messages:stream",
				outputStructure: "detailed",
			})
			.input(messageInputSchema())
			.handler(async ({ input, context }) => {
				const stream = createSseStream();
				const messageInput = tc(() => validateHttpMessage(input));
				if (messageInput.error) {
					stream.event("message.error", { error: errorMessage(messageInput.error) });
					stream.close();
					return streamResponse(stream);
				}

				const message = messageFromHttp(messageInput.data);
				const output = await tc(context.core.handleMessage(message));
				if (output.error) {
					stream.event("message.error", { error: errorMessage(output.error) });
					stream.close();
					return streamResponse(stream);
				}

				const channel = new HttpChannel("http", stream);
				void channel.send(output.data).catch((error: unknown) => {
					stream.event("message.error", { error: errorMessage(error) });
					stream.close();
				});

				return streamResponse(stream);
			}),
	};
}

function messageInputSchema() {
	return z.object({
		conversationId: z.string().min(1),
		sender: z.object({ id: z.string().min(1) }).passthrough(),
		text: z.string().min(1),
	});
}

interface ServerSseStream extends SseStream {
	body: ReadableStream<Uint8Array>;
}

function createSseStream(): ServerSseStream {
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(nextController) {
			controller = nextController;
		},
	});

	return {
		body,
		event(name, data) {
			controller?.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
		},
		close() {
			controller?.close();
			controller = undefined;
		},
	};
}

function streamResponse(stream: ServerSseStream) {
	return {
		headers: {
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Content-Type": "text/event-stream",
		},
		body: stream.body,
	};
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

function badRequest(error: unknown, fallback: string): ORPCError<"BAD_REQUEST", undefined> {
	return new ORPCError("BAD_REQUEST", { message: errorMessage(error, fallback) });
}

function errorMessage(error: unknown, fallback?: string): string {
	const message = error instanceof Error ? error.message : "Unknown error";
	return fallback ? `${fallback}: ${message}` : message;
}
