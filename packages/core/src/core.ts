import {
	agentEventTextDelta,
	type ConversationHistory,
	type ConversationKey,
	createFileStateManager,
	loadConversation,
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
import type { AppExtension } from "./apps/index.ts";
import { ChannelRegistry } from "./channel-registry.ts";
import { type ExtensionLoader, FileSystemExtensionLoader } from "./extensions/index.ts";
import { type ReloadResult, reload } from "./reload.ts";
import { sqlite } from "./sqlite.ts";

export interface RhoCoreOptions {
	channels?: Channel[];
	cwd?: string;
	extensionPaths?: string[];
	extensionLoader?: ExtensionLoader;
	state?: StateManager;
}

export interface RhoCore {
	runtime: ChannelRuntime;
	channels: ChannelRegistry;
	extensionLoader: ExtensionLoader;
	state: StateManager;
	handleMessage(message: ChannelMessage): Promise<ChannelOutput>;
	loadConversation(key: ConversationKey): Promise<ConversationHistory>;
	listApps(): Promise<AppExtension[]>;
	replaceChannels(channels: Channel[]): void;
	reload(): Promise<ReloadResult>;
	activeChannelIds(): string[];
	close(): Promise<void>;
}

export async function createRhoCore(options: RhoCoreOptions = {}): Promise<RhoCore> {
	const channels = options.channels ?? [];
	const channelRegistry = new ChannelRegistry(channels);

	const state = options.state ?? createFileStateManager();
	const extensionLoader = options.extensionLoader ?? new FileSystemExtensionLoader(options);

	const runtime = new ChannelRuntime({
		channels: channelRegistry.current(),
		handle: async (message) => agentResponse(state, message),
	});

	const replaceChannels = (nextChannels: Channel[]) => {
		channelRegistry.replace(nextChannels);
		runtime.replaceChannels(channelRegistry.current());
	};

	const handleMessage = async (message: ChannelMessage) => runtime.handle(message);

	const listApps = async () => {
		const result = await extensionLoader.load();
		return result.extensions.flatMap((extension) => extension.apps);
	};

	const core: RhoCore = {
		runtime,
		channels: channelRegistry,
		extensionLoader,
		state,
		handleMessage,
		loadConversation: async (key) => loadConversation(state, key),
		listApps,
		replaceChannels,
		reload: async () =>
			reload({
				extensionLoader,
				replaceChannels,
				activeChannelIds: () => channelRegistry.current().map((channel) => channel.id),
			}),
		activeChannelIds: () => channelRegistry.current().map((channel) => channel.id),
		close: async () => {
			await runtime.stop();
			sqlite.close();
		},
	};

	await core.reload();
	return core;
}

async function* agentResponse(state: StateManager, message: ChannelMessage): AsyncIterable<ChannelMessage> {
	const stream = respondInConversation({
		state,
		key: conversationKey(message),
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
