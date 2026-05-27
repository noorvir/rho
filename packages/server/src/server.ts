import type { ChannelRuntime, HttpChannel, SseStream } from "@rho/channels";
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
	app.post("/channels/http/messages", async (context) => handleHttpMessage(context, deps));

	return app;
}

async function handleHttpMessage(context: Context, deps: ServerDeps): Promise<Response> {
	const streamId = crypto.randomUUID();
	const stream = createSseStream();

	try {
		const input = validateHttpMessage(await context.req.json());
		deps.httpChannel.attach(streamId, stream);

		deps.runtime.receive(messageFromHttp(input, streamId)).catch((error: unknown) => {
			stream.event("message.error", { error: errorMessage(error) });
			stream.close();
			deps.httpChannel.detach(streamId);
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

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}
