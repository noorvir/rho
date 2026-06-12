import { join } from "node:path";
import {
	agentEventTextDelta,
	backgroundTaskExtension,
	type ConversationHistory,
	type ConversationInput,
	type ConversationKey,
	createFileStateManager,
	loadConversation,
	type RhoAgentExtensionSource,
	respondInConversation,
	rhoContextExtension,
	rhoMigrateExtension,
	rhoReloadExtension,
	type StateManager,
} from "@rho/ai";
import {
	type Channel,
	type ChannelMessage,
	type ChannelOutput,
	ChannelRuntime,
	messageText,
} from "@rho/channels";
import { type AppExtension, AppRegistry } from "./apps/index.ts";
import { ChannelRegistry } from "./channel-registry.ts";
import { type AgentExtension, type ExtensionLoader, FileSystemExtensionLoader } from "./extensions/index.ts";
import type { rho_sys_Task as Task } from "./generated/prisma/client.ts";
import { migrateRuntimeSchema } from "./migrate.ts";
import { createReloadableRhoPrisma } from "./prisma.ts";
import { type ReloadResult, reload } from "./reload.ts";
import { KeyedMutex, TaskRunner } from "./tasks.ts";

export interface RhoCoreOptions {
	channels?: Channel[];
	/** Absolute working directory for agent sessions; tools run and project extensions are discovered here. */
	cwd: string;
	/** Absolute agent config directory (auth.json, models.json, settings.json). */
	agentDir: string;
	/** Absolute conversation state directory. Defaults to `<agentDir>/rho-state`. */
	stateDir?: string;
	/** Shared SQLite database URL, for example `file:/path/to/rho.sqlite`. */
	databaseUrl: string;
	/** Absolute directory of the runtime-generated Prisma client (`db/generated/prisma`); reloads import from it. */
	generatedClientDir?: string;
	/** Absolute runtime db directory (`$RHO_HOME/db`); enables the rho_migrate tool. */
	dbDir?: string;
	/** Reasoning effort for background task sessions; defaults to medium. */
	taskThinkingLevel?: "minimal" | "low" | "medium" | "high";
	/** Overrides the settings-default model for background task sessions. */
	taskModel?: { provider: string; modelId: string };
	/** Absolute directory containing the Rho docs; enables the rho_context tool. */
	docsDir?: string;
	/** Absolute extensions workspace directory. Defaults to `<cwd>/.rho/extensions`. */
	extensionsDir?: string;
	/** Absolute extension entrypoints or directories to load. */
	extensionPaths?: string[];
	extensionLoader?: ExtensionLoader;
	state?: StateManager;
}

export interface RhoCore {
	runtime: ChannelRuntime;
	apps: AppRegistry;
	channels: ChannelRegistry;
	extensionLoader: ExtensionLoader;
	state: StateManager;
	handleMessage(message: ChannelMessage): Promise<ChannelOutput>;
	loadConversation(key: ConversationKey): Promise<ConversationHistory>;
	listTasks(key: ConversationKey): Promise<Task[]>;
	listApps(): Promise<AppExtension[]>;
	replaceApps(apps: AppExtension[]): void;
	replaceChannels(channels: Channel[]): void;
	replaceAgentExtensions(agentExtensions: AgentExtension[]): void;
	reload(): Promise<ReloadResult>;
	activeChannelIds(): string[];
	close(): Promise<void>;
}

export async function createRhoCore(opts: RhoCoreOptions): Promise<RhoCore> {
	const channels = opts.channels ?? [];
	const cwd = opts.cwd;
	const appRegistry = new AppRegistry();
	const channelRegistry = new ChannelRegistry(channels);

	const stateDir = opts.stateDir ?? join(opts.agentDir, "rho-state");
	const extensionsDir = opts.extensionsDir ?? join(cwd, ".rho", "extensions");
	const extensionPaths = opts.extensionPaths ?? [];

	const state =
		opts.state ??
		createFileStateManager({
			cwd,
			rootDir: stateDir,
		});

	const prismaHandle = createReloadableRhoPrisma(opts.databaseUrl, {
		generatedClientDir: opts.generatedClientDir,
	});
	const prisma = prismaHandle.client;
	if (opts.generatedClientDir) {
		// The static client only knows system models; runtimes with a generated
		// home client swap it in before anything queries runtime-added models.
		await prismaHandle.reload();
	}
	const conversations = new KeyedMutex();

	const extensionLoader =
		opts.extensionLoader ??
		new FileSystemExtensionLoader({
			extensionsDir,
			extensionPaths,
			db: prisma,
		});

	let agentExtensions: AgentExtension[] = [];

	const runtimeToolSources: RhoAgentExtensionSource[] = [];
	if (opts.docsDir) {
		runtimeToolSources.push({ type: "factory", factory: rhoContextExtension({ docsDir: opts.docsDir }) });
	}
	runtimeToolSources.push({
		type: "factory",
		factory: rhoReloadExtension(async () => reloadSummary(await core.reload())),
	});
	if (opts.dbDir) {
		const dbDir = opts.dbDir;
		runtimeToolSources.push({
			type: "factory",
			factory: rhoMigrateExtension(async (name) => {
				const migrated = await migrateRuntimeSchema({ dbDir, databaseUrl: opts.databaseUrl }, name);
				const reloaded = reloadSummary(await core.reload());
				return `${migrated}\n${reloaded}`;
			}),
		});
	}

	const sessionExtensions = (): RhoAgentExtensionSource[] => [
		...runtimeToolSources,
		...agentExtensionSources(agentExtensions),
	];

	const tasks = new TaskRunner({
		prisma,
		state,
		cwd,
		agentDir: opts.agentDir,
		sessionsDir: join(stateDir, "sessions"),
		agentExtensions: sessionExtensions,
		conversations,
		taskThinkingLevel: opts.taskThinkingLevel,
		taskModel: opts.taskModel,
	});

	const runtime = new ChannelRuntime({
		channels: channelRegistry.current(),
		handle: async (message) =>
			agentResponse({
				cwd,
				agentDir: opts.agentDir,
				state,
				message,
				conversations,
				agentExtensions: [
					...sessionExtensions(),
					{
						type: "factory",
						factory: backgroundTaskExtension(async (request) => {
							const task = await tasks.create({
								conversationKey: conversationKey(message),
								channelId: message.channelId,
								targetType: message.target.type,
								targetId: message.target.id,
								title: request.title,
								instructions: request.instructions,
							});
							return { taskId: task.id };
						}),
					},
				],
			}),
	});

	const replaceApps = (nextApps: AppExtension[]) => {
		appRegistry.replace(nextApps);
	};

	const replaceChannels = (nextChannels: Channel[]) => {
		channelRegistry.replace(nextChannels);
		runtime.replaceChannels(channelRegistry.current());
	};

	const replaceAgentExtensions = (next: AgentExtension[]) => {
		agentExtensions = next;
	};

	const handleMessage = async (message: ChannelMessage) => runtime.handle(message);

	const listApps = async () => appRegistry.current();

	const core: RhoCore = {
		runtime,
		apps: appRegistry,
		channels: channelRegistry,
		extensionLoader,
		state,
		handleMessage,
		loadConversation: async (key) => loadConversation(state, key),
		listTasks: async (key) => tasks.listForConversation(key),
		listApps,
		replaceApps,
		replaceChannels,
		replaceAgentExtensions,
		reload: async () => {
			await prismaHandle.reload();
			return reload({
				extensionLoader,
				replaceApps,
				replaceChannels,
				replaceAgentExtensions,
				activeChannelIds: () => channelRegistry.current().map((channel) => channel.id),
			});
		},
		activeChannelIds: () => channelRegistry.current().map((channel) => channel.id),
		close: async () => {
			await tasks.stop();
			await runtime.stop();
			await prisma.$disconnect();
		},
	};

	await core.reload();
	await tasks.start();
	return core;
}

function reloadSummary(result: ReloadResult): string {
	const issues = result.diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`);
	const status = result.ok ? "Reload succeeded." : "Reload failed; previous extensions stay active.";
	const summary = `${status} Apps: ${result.apps}. Channels: ${result.channels.join(", ") || "none"}.`;
	return issues.length > 0 ? `${summary}\nDiagnostics:\n${issues.join("\n")}` : summary;
}

function agentExtensionSources(extensions: AgentExtension[]): RhoAgentExtensionSource[] {
	return extensions.flatMap((extension) => extension.sources);
}

interface AgentResponseInput {
	cwd: string;
	agentDir: string;
	state: StateManager;
	message: ChannelMessage;
	conversations: KeyedMutex;
	agentExtensions: RhoAgentExtensionSource[];
}

async function* agentResponse(input: AgentResponseInput): AsyncIterable<ChannelMessage> {
	const key = conversationKey(input.message);
	const release = await input.conversations.acquire(key);

	try {
		const stream = respondInConversation({
			state: input.state,
			key,
			cwd: input.cwd,
			agentDir: input.agentDir,
			agentExtensions: input.agentExtensions,
			message: {
				role: "user",
				content: messageText(input.message),
				timestamp: input.message.timestamp.getTime(),
			},
			signal: new AbortController().signal,
		});

		let emittedText = false;
		for await (const event of stream) {
			const delta = agentEventTextDelta(event);
			if (delta) {
				emittedText = true;
				yield agentMessage(input.message, delta);
			}
		}

		if (emittedText) {
			return;
		}

		const messages = await stream.result();
		const text = lastAssistantText(messages);
		if (!text) {
			throw new Error(
				"The Rho agent did not produce a response. Check the deployed agent provider, model, and auth configuration.",
			);
		}

		yield agentMessage(input.message, text);
	} finally {
		release();
	}
}

function agentMessage(input: ChannelMessage, text: string): ChannelMessage {
	return {
		id: `msg:${crypto.randomUUID()}`,
		channelId: input.channelId,
		target: input.target,
		from: { id: "assistant", role: "assistant" },
		content: [{ type: "text", text }],
		timestamp: new Date(),
		replyTo: input.id,
		attachments: [],
		metadata: input.metadata,
		raw: null,
	};
}

function lastAssistantText(messages: ConversationInput["message"][]): string {
	for (const message of [...messages].reverse()) {
		if (message.role !== "assistant") {
			continue;
		}

		const text = message.content
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("\n")
			.trim();
		if (text) {
			return text;
		}
	}

	return "";
}

function conversationKey(message: ChannelMessage): string {
	return `${message.channelId}:${message.target.type}:${message.target.id}`;
}
