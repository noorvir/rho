import { join } from "node:path";
import {
	agentEventTextDelta,
	type ConversationHistory,
	type ConversationInput,
	type ConversationKey,
	createFileStateManager,
	loadConversation,
	type RhoAgentExtensionSource,
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
import { type AgentExtension, type ExtensionLoader, FileSystemExtensionLoader } from "./extensions/index.ts";
import { type ReloadResult, reload } from "./reload.ts";

export interface RhoCoreOptions {
	channels?: Channel[];
	/** Absolute working directory for agent sessions; tools run and project extensions are discovered here. */
	cwd: string;
	/** Absolute agent config directory (auth.json, models.json, settings.json). */
	agentDir: string;
	/** Absolute conversation state directory. Defaults to `<agentDir>/rho-state`. */
	stateDir?: string;
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
	const extensionsDir = join(cwd, ".rho", "extensions");
	const extensionPaths = opts.extensionPaths ?? [];

	const state =
		opts.state ??
		createFileStateManager({
			cwd,
			rootDir: stateDir,
		});

	const extensionLoader =
		opts.extensionLoader ??
		new FileSystemExtensionLoader({
			extensionsDir,
			extensionPaths,
		});

	let agentExtensions: AgentExtension[] = [];

	const runtime = new ChannelRuntime({
		channels: channelRegistry.current(),
		handle: async (message) =>
			agentResponse({
				cwd,
				agentDir: opts.agentDir,
				state,
				message,
				agentExtensions: agentExtensionSources(agentExtensions),
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
		listApps,
		replaceApps,
		replaceChannels,
		replaceAgentExtensions,
		reload: async () =>
			reload({
				extensionLoader,
				replaceApps,
				replaceChannels,
				replaceAgentExtensions,
				activeChannelIds: () => channelRegistry.current().map((channel) => channel.id),
			}),
		activeChannelIds: () => channelRegistry.current().map((channel) => channel.id),
		close: async () => {
			await runtime.stop();
		},
	};

	await core.reload();
	return core;
}

function agentExtensionSources(extensions: AgentExtension[]): RhoAgentExtensionSource[] {
	return extensions.flatMap((extension) => extension.sources);
}

interface AgentResponseInput {
	cwd: string;
	agentDir: string;
	state: StateManager;
	message: ChannelMessage;
	agentExtensions: RhoAgentExtensionSource[];
}

async function* agentResponse(input: AgentResponseInput): AsyncIterable<ChannelMessage> {
	const stream = respondInConversation({
		state: input.state,
		key: conversationKey(input.message),
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
