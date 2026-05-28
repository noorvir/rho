import {
	type ChannelMessage,
	type ChannelOutput,
	type ChannelRuntime,
	HttpChannel,
	messageText,
	type SseStream,
} from "@rho/channels";
import { type Context, Hono } from "hono";
import type { ChannelRegistry } from "./channel-registry.ts";
import { messageFromHttp, validateHttpMessage } from "./http-message.ts";
import { type RegistrySource, reload } from "./reload.ts";

export interface ServerDeps {
	runtime: ChannelRuntime;
	httpChannel: HttpChannel;
	channels: ChannelRegistry;
	files: RegistrySource;
}

export function createServer(deps: ServerDeps): Hono {
	const app = new Hono();

	app.get("/health", (context) => context.json({ ok: true }));
	app.post("/reload", async (context) => context.json(await reload(deps)));
	app.post("/agent/messages", async (context) => handleAgentMessage(context, deps));
	app.post("/agent/messages:stream", async (context) => handleAgentMessageStream(context, deps));

	return app;
}

async function handleAgentMessage(context: Context, deps: ServerDeps): Promise<Response> {
	try {
		const input = validateHttpMessage(await context.req.json());
		const output = await deps.runtime.handle(messageFromHttp(input));
		const message = await collectMessage(output);

		return context.json({ message });
	} catch (error) {
		return context.json({ error: errorMessage(error) }, 400);
	}
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
	if (!isMessageStream(output)) return output;

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

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}
