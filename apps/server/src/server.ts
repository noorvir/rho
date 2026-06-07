import { relative } from "node:path";
import { pathToFileURL } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import type { RhoAppApiContext, RhoAppApiHandler } from "@rho/apps-sdk";
import {
	type ChannelMessage,
	type ChannelOutput,
	HttpChannel,
	messageText,
	type SseStream,
} from "@rho/channels";
import { getTableData, getTables, type RhoCore } from "@rho/core";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { conversationKey, messageFromHttp, validateHttpMessage } from "./http-message.ts";

export interface ServerOptions {
	core: RhoCore;
	apiSecret?: string;
	webRoot?: string;
}

export function createServer(options: ServerOptions): Hono {
	const app = new Hono();
	const webRoot = options.webRoot ? relative(process.cwd(), options.webRoot) : undefined;

	app.use(
		"*",
		cors({
			allowHeaders: ["Authorization", "Content-Type"],
			allowMethods: ["GET", "POST", "OPTIONS"],
			origin: "*",
		}),
	);
	app.get("/health", (context) => context.json({ ok: true }));

	if (webRoot) {
		app.use("*", serveStatic({ root: webRoot }));
	}

	app.use("/apps.json", apiAuth(options));
	app.use("/reload", apiAuth(options));
	app.use("/tables", apiAuth(options));
	app.use("/tables/*", apiAuth(options));
	app.use("/agent/*", apiAuth(options));
	app.use("/apps/*/api/*", apiAuth(options));

	app.get("/apps.json", async (context) =>
		context.json({ apps: appSummaries(await options.core.listApps()) }),
	);
	app.post("/reload", async (context) => context.json(await options.core.reload()));
	app.get("/tables", async (context) => context.json({ tables: await getTables() }));
	app.get("/tables/:name", async (context) => tableData(context));
	app.get("/agent/conversations/:id/messages", async (context) => messages(context, options.core));
	app.post("/agent/messages", async (context) => handleMessage(context, options.core));
	app.post("/agent/messages:stream", async (context) => handleMessageStream(context, options.core));
	app.all("/apps/:slug/api/*", async (context) => handleAppApi(context, options.core));

	if (webRoot) {
		const serveWebApp = serveStatic({ root: webRoot, path: "index.html" });
		app.get("*", async (context) => {
			if (!acceptsHtml(context)) {
				return context.notFound();
			}

			const response = await serveWebApp(context, async () => {});
			return response ?? context.notFound();
		});
	}

	return app;
}

interface AppSummary {
	slug: string;
	name: string;
	clientModuleUrl: string;
	routes: Array<{ path: string; label?: string }>;
	apiBasePath?: string;
}

function appSummaries(apps: Awaited<ReturnType<RhoCore["listApps"]>>): AppSummary[] {
	return apps.map((app) => ({
		slug: app.slug,
		name: app.name,
		clientModuleUrl: sourceModuleUrl(app.client.entry),
		routes: app.routes.map((route) => ({ path: route.path, label: route.label })),
		apiBasePath: app.api ? `/apps/${app.slug}${app.api.basePath}` : undefined,
	}));
}

function sourceModuleUrl(path: string): string {
	return `/@fs${path}`;
}

function acceptsHtml(context: Context): boolean {
	return context.req.header("Accept")?.includes("text/html") ?? false;
}

async function handleAppApi(context: Context, core: RhoCore): Promise<Response> {
	const slug = context.req.param("slug");
	const apps = await core.listApps();
	const app = apps.find((candidate) => candidate.slug === slug);
	if (!app?.api) {
		return context.json({ error: "Unknown app API" }, 404);
	}

	const api = await import(pathToFileURL(app.api.entry).href);
	if (!isAppApiModule(api)) {
		return context.json({ error: "Invalid app API module" }, 500);
	}

	const externalApiBasePath = `/apps/${app.slug}${app.api.basePath}`;
	const response = await api.fetch(context.req.raw, {
		app: {
			slug: app.slug,
			name: app.name,
			basePath: `/apps/${app.slug}`,
			apiBasePath: externalApiBasePath,
		},
		host: {
			platform: hostPlatform(context),
		},
	});
	return response;
}

interface AppApiModule {
	fetch: RhoAppApiHandler;
}

function isAppApiModule(value: unknown): value is AppApiModule {
	return typeof value === "object" && value !== null && "fetch" in value && typeof value.fetch === "function";
}

function hostPlatform(context: Context): RhoAppApiContext["host"]["platform"] {
	const value = context.req.header("X-Rho-Platform");
	return value === "mobile" || value === "desktop" ? value : "web";
}

function apiAuth(options: ServerOptions) {
	return async (context: Context, next: () => Promise<void>) => {
		if (!options.apiSecret || context.req.header("Authorization") === `Bearer ${options.apiSecret}`) {
			await next();
			return;
		}

		return context.json({ error: "Unauthorized" }, 401);
	};
}

async function tableData(context: Context): Promise<Response> {
	const name = context.req.param("name");
	if (!name) {
		return context.json({ error: "table name is required" }, 400);
	}

	const table = await getTableData(name, {
		limit: numberParam(context.req.query("limit")),
		offset: numberParam(context.req.query("offset")),
		orderBy: context.req.query("orderBy"),
		order: context.req.query("order"),
	});
	if (!table) {
		return context.json({ error: "Unknown table" }, 404);
	}

	return context.json(table);
}

async function messages(context: Context, core: RhoCore): Promise<Response> {
	const id = context.req.param("id");
	if (!id) {
		return context.json({ error: "conversation id is required" }, 400);
	}

	try {
		return context.json(await core.loadConversation(conversationKey(id)));
	} catch (error) {
		return context.json({ error: errorMessage(error, "Failed to load messages") }, 400);
	}
}

async function handleMessage(context: Context, core: RhoCore): Promise<Response> {
	try {
		const input = validateHttpMessage(await context.req.json());
		const output = await core.handleMessage(messageFromHttp(input));
		return context.json({ message: await collectMessage(output) });
	} catch (error) {
		return context.json({ error: errorMessage(error, "Failed to handle message") }, 400);
	}
}

async function handleMessageStream(context: Context, core: RhoCore): Promise<Response> {
	const stream = createSseStream();

	try {
		const input = validateHttpMessage(await context.req.json());
		const output = await core.handleMessage(messageFromHttp(input));
		const channel = new HttpChannel("http", stream);

		void channel.send(output).catch((error: unknown) => {
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

function numberParam(value: string | undefined): number | undefined {
	return value ? Number(value) : undefined;
}

function errorMessage(error: unknown, fallback?: string): string {
	const message = error instanceof Error ? error.message : "Unknown error";
	return fallback ? `${fallback}: ${message}` : message;
}
