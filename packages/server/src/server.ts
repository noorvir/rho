import { loadConversation, type StateManager } from "@rho/ai";
import {
	type ChannelMessage,
	type ChannelOutput,
	type ChannelRuntime,
	HttpChannel,
	messageText,
	type SseStream,
} from "@rho/channels";
import { tc, wrapError } from "@rho/lib";
import { type Context, Hono } from "hono";
import type { ChannelRegistry } from "./channel-registry.ts";
import { messageFromHttp, validateHttpMessage } from "./http-message.ts";
import { type RegistrySource, reload } from "./reload.ts";

export interface ServerDeps {
	runtime: ChannelRuntime;
	httpChannel: HttpChannel;
	channels: ChannelRegistry;
	files: RegistrySource;
	state: StateManager;
	apiSecret?: string;
}

export function createServer(deps: ServerDeps): Hono {
	const app = new Hono();

	app.get("/health", (context) => context.json({ ok: true }));
	app.use("*", async (context, next) => {
		if (!deps.apiSecret || context.req.header("Authorization") === `Bearer ${deps.apiSecret}`) {
			await next();
			return;
		}

		return context.json({ error: "Unauthorized" }, 401);
	});
	app.post("/reload", async (context) => context.json(await reload(deps)));
	app.get("/agent/conversations/:id/messages", async (context) => messages(context, deps));
	app.post("/agent/messages", async (context) => handleAgentMessage(context, deps));
	app.post("/agent/messages:stream", async (context) => handleAgentMessageStream(context, deps));

	return app;
}

async function messages(context: Context, deps: ServerDeps): Promise<Response> {
	const id = context.req.param("id");
	if (!id) {
		return context.json({ error: "conversation id is required" }, 400);
	}

	const result = await tc(loadConversation(deps.state, conversationKey(id)));
	if (result.error) {
		return context.json({ error: wrapError(result.error, "Failed to load messages").message }, 400);
	}

	return context.json(result.data);
}

async function handleAgentMessage(context: Context, deps: ServerDeps): Promise<Response> {
	const result = await tc(
		(async () => {
			const input = validateHttpMessage(await context.req.json());
			const output = await deps.runtime.handle(messageFromHttp(input));
			return collectMessage(output);
		})(),
	);
	if (result.error) {
		return context.json(
			{ error: wrapError(result.error, "Failed to handle message").message },
			400,
		);
	}

	return context.json({ message: result.data });
}

async function handleAgentMessageStream(context: Context, deps: ServerDeps): Promise<Response> {
	const stream = createSseStream();

	try {
		const input = validateHttpMessage(await context.req.json());
		const output = await deps.runtime.handle(messageFromHttp(input));
		const channel = new HttpChannel(deps.httpChannel.id, stream);

		channel.send(output).catch((error: unknown) => {
			stream.event("message.error", { error: errorMessage(error) });
			stream.close();
		});
	} catch (error) {
		stream.event("message.error", { error: errorMessage(error) });
		stream.close();
	}

	return stream.response;
}

interface ServerSseStream extends SseStream {
	response: Response;
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
		response: new Response(body, {
			headers: {
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"Content-Type": "text/event-stream",
			},
		}),
		event(name, data) {
			controller?.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
		},
		close() {
			controller?.close();
			controller = undefined;
		},
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

function conversationKey(conversationId: string): string {
	return `http:conversation:${conversationId}`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}
