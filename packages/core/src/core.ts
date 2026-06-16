import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	agentEventTextDelta,
	backgroundTaskExtension,
	type ConversationHistory,
	type ConversationInput,
	type ConversationKey,
	createFileStateManager,
	loadConversation,
	rhoAppsExtension,
	rhoCronCreateExtension,
	rhoCronsExtension,
	rhoCronUpdateExtension,
	rhoContextExtension,
	rhoMigrateExtension,
	rhoNotificationsExtension,
	rhoQueryExtension,
	rhoReloadExtension,
	rhoValidateSchemaExtension,
	type RhoAgentExtensionSource,
	type RhoContent,
	respondInConversation,
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
import {
	type CronRegistration,
	CronScheduler,
	type CronListScope,
	type CronSummary,
	getDefaultTimezone,
} from "./crons.ts";
import { queryRuntimeDatabase } from "./db.ts";
import { type AgentExtension, type ExtensionLoader, FileSystemExtensionLoader } from "./extensions/index.ts";
import type { rho_sys_Task as Task } from "./generated/prisma/client.ts";
import { migrateRuntimeSchema, validateRuntimeSchema } from "./migrate.ts";
import {
	NotificationService,
	type NotificationDefRegistration,
	type NotificationSummary,
} from "./notifications.ts";
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
	/** Reasoning effort for channel chat turns; defaults to minimal for fast replies. */
	channelThinkingLevel?: "minimal" | "low" | "medium" | "high";
	/** Overrides the settings-default model for channel chat turns; keeps chat snappy. */
	channelModel?: { provider: string; modelId: string };
	/** Absolute directory containing the Rho docs; enables the rho_context tool. */
	docsDir?: string;
	/** Absolute extensions workspace directory. Defaults to `<cwd>/.rho/extensions`. */
	extensionsDir?: string;
	/** Absolute extension entrypoints or directories to load. */
	extensionPaths?: string[];
	/** Default IANA timezone for cron schedules when the user did not specify one. */
	defaultTimezone?: string;
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
	listCrons(scope: CronListScope): Promise<CronSummary[]>;
	listReminders(): Promise<CronSummary[]>;
	listNotifications(): Promise<NotificationSummary[]>;
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
	const defaultTimezone = opts.defaultTimezone ?? getDefaultTimezone();

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
	const notifications = new NotificationService({ prisma });

	let cronScheduler: CronScheduler;

	const extensionLoader =
		opts.extensionLoader ??
		new FileSystemExtensionLoader({
			extensionsDir,
			extensionPaths,
			db: prisma,
			defaultTimezone,
			notifications,
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
	runtimeToolSources.push({
		type: "factory",
		factory: rhoQueryExtension((sql) => queryRuntimeDatabase(opts.databaseUrl, sql)),
	});
	runtimeToolSources.push({
		type: "factory",
		factory: rhoAppsExtension(async () =>
			appRegistry.current().map((app) => ({ name: app.name, slug: app.slug, routes: app.routes })),
		),
	});
	runtimeToolSources.push({
		type: "factory",
		factory: rhoNotificationsExtension(
			() => notifications.agentPrompt(),
			async (request) => {
				const result = await notifications.emit({
					key: request.key,
					title: request.title,
					body: request.body,
					level: request.level,
					idempotencyKey: request.idempotencyKey,
					target: request.target,
				});
				if (!result.ok) {
					return { ok: false, error: result.error };
				}
				return { ok: true, notificationId: result.notification.id };
			},
		),
	});
	runtimeToolSources.push({
		type: "factory",
		factory: rhoCronsExtension((scope) => cronScheduler.listCrons(scope)),
	});
	if (opts.dbDir) {
		const dbDir = opts.dbDir;
		runtimeToolSources.push({
			type: "factory",
			factory: rhoValidateSchemaExtension((name) =>
				validateRuntimeSchema({ dbDir, databaseUrl: opts.databaseUrl }, name),
			),
		});
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

	cronScheduler = new CronScheduler({ prisma, tasks });

	const runtime = new ChannelRuntime({
		channels: channelRegistry.current(),
		handle: async (message) =>
			agentResponse({
				cwd,
				agentDir: opts.agentDir,
				state,
				message,
				conversations,
				model: opts.channelModel,
				thinkingLevel: opts.channelThinkingLevel,
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
					{
						type: "factory",
						factory: rhoCronCreateExtension(async (request) => {
							const cron = await cronScheduler.createAgentCron({
								conversationKey: conversationKey(message),
								channelId: message.channelId,
								targetType: message.target.type,
								targetId: message.target.id,
								title: request.title,
								schedule: request.schedule,
								enabled: request.enabled,
								purpose: request.purpose,
								instructions: request.instructions,
							});
							return { id: cron.id };
						}, defaultTimezone),
					},
					{
						type: "factory",
						factory: rhoCronUpdateExtension(async (request) => {
							const cron = await cronScheduler.updateCron(request);
							return { id: cron.id };
						}, defaultTimezone),
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

	const replaceCrons = (next: CronRegistration[]) => cronScheduler.replaceCrons(next);
	const replaceNotificationDefs = (next: NotificationDefRegistration[]) => notifications.replaceDefs(next);

	const handleMessage = async (message: ChannelMessage) => runtime.handle(message);

	const listApps = async () => appRegistry.current();
	const listCrons = async (scope: CronListScope) => cronScheduler.listCrons(scope);
	const listReminders = async () => cronScheduler.listReminders();
	const listNotifications = async () => notifications.listNotifications();

	const core: RhoCore = {
		runtime,
		apps: appRegistry,
		channels: channelRegistry,
		extensionLoader,
		state,
		handleMessage,
		loadConversation: async (key) => loadConversation(state, key),
		listTasks: async (key) => tasks.listForConversation(key),
		listCrons,
		listReminders,
		listNotifications,
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
				replaceCrons,
				replaceNotificationDefs,
				activeChannelIds: () => channelRegistry.current().map((channel) => channel.id),
			});
		},
		activeChannelIds: () => channelRegistry.current().map((channel) => channel.id),
		close: async () => {
			await cronScheduler.stop();
			await tasks.stop();
			await runtime.stop();
			await prisma.$disconnect();
		},
	};

	await core.reload();
	await tasks.start();
	await cronScheduler.start();
	return core;
}

function reloadSummary(result: ReloadResult): string {
	const issues = result.diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`);
	const status = result.ok ? "Reload succeeded." : "Reload failed; previous extensions stay active.";
	const summary = `${status} Apps: ${result.apps}. Crons: ${result.crons}. Channels: ${result.channels.join(", ") || "none"}.`;
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
	model?: { provider: string; modelId: string };
	thinkingLevel?: "minimal" | "low" | "medium" | "high";
}

async function* agentResponse(input: AgentResponseInput): AsyncIterable<ChannelMessage> {
	const key = conversationKey(input.message);
	const release = await input.conversations.acquire(key);

	try {
		const images = await messageImages(input.message);
		const text = messageText(input.message);
		const content: string | RhoContent[] = images.length === 0 ? text : [{ type: "text", text }, ...images];

		const stream = respondInConversation({
			state: input.state,
			key,
			cwd: input.cwd,
			agentDir: input.agentDir,
			agentExtensions: input.agentExtensions,
			model: input.model,
			thinkingLevel: input.thinkingLevel,
			message: {
				role: "user",
				content,
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
		const finalText = lastAssistantText(messages);
		if (!finalText) {
			throw new Error(
				"The Rho agent did not produce a response. Check the deployed agent provider, model, and auth configuration.",
			);
		}

		yield agentMessage(input.message, finalText);
	} finally {
		release();
	}
}

/**
 * Loads file-backed image content from a channel message as base64 image
 * parts for the agent prompt, mirroring pi's own image paste flow.
 */
async function messageImages(message: ChannelMessage): Promise<RhoContent[]> {
	const images: RhoContent[] = [];

	for (const part of message.content) {
		if (part.type !== "image" || part.media.kind !== "file") {
			continue;
		}

		const bytes = await readFile(part.media.path);
		images.push({
			type: "image",
			data: bytes.toString("base64"),
			mimeType: part.media.mimeType,
		});
	}

	return images;
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
