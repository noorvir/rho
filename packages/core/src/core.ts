import {
	agentEventTextDelta,
	type ConversationHistory,
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
	cwd?: string;
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

export async function createRhoCore(options: RhoCoreOptions = {}): Promise<RhoCore> {
	const channels = options.channels ?? [];
	const appRegistry = new AppRegistry();
	const channelRegistry = new ChannelRegistry(channels);

	const state = options.state ?? createFileStateManager();
	const extensionLoader = options.extensionLoader ?? new FileSystemExtensionLoader(options);

	let agentExtensions: AgentExtension[] = [];

	const runtime = new ChannelRuntime({
		channels: channelRegistry.current(),
		handle: async (message) => agentResponse(state, message, agentExtensionSources(agentExtensions)),
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

async function* agentResponse(
	state: StateManager,
	message: ChannelMessage,
	agentExtensions: RhoAgentExtensionSource[],
): AsyncIterable<ChannelMessage> {
	const stream = respondInConversation({
		state,
		key: conversationKey(message),
		agentExtensions,
		message: {
			role: "user",
			content: messageText(message),
			timestamp: message.timestamp.getTime(),
		},
		signal: new AbortController().signal,
	});

	for await (const event of stream) {
		const delta = agentEventTextDelta(event);
		if (delta) {
			yield {
				id: `msg:${crypto.randomUUID()}`,
				channelId: message.channelId,
				target: message.target,
				from: { id: "assistant", role: "assistant" },
				content: [{ type: "text", text: delta }],
				timestamp: new Date(),
				replyTo: message.id,
				attachments: [],
				metadata: message.metadata,
				raw: null,
			};
		}
	}
}

function conversationKey(message: ChannelMessage): string {
	return `${message.channelId}:${message.target.type}:${message.target.id}`;
}
