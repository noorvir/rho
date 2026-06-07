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
import { ChannelRegistry } from "./channel-registry.ts";
import { EmptyRegistrySource, type RegistrySource, type ReloadResult, reload } from "./reload.ts";
import { sqlite } from "./sqlite.ts";

export interface RhoCoreOptions {
	channels?: Channel[];
	files?: RegistrySource;
	state?: StateManager;
}

export interface RhoCore {
	runtime: ChannelRuntime;
	channels: ChannelRegistry;
	files: RegistrySource;
	state: StateManager;
	handleMessage(message: ChannelMessage): Promise<ChannelOutput>;
	loadConversation(key: ConversationKey): Promise<ConversationHistory>;
	replaceChannels(channels: Channel[]): void;
	reload(): Promise<ReloadResult>;
	activeChannelIds(): string[];
	close(): Promise<void>;
}

export async function createRhoCore(options: RhoCoreOptions = {}): Promise<RhoCore> {
	const channels = new ChannelRegistry(options.channels ?? []);
	const files = options.files ?? new EmptyRegistrySource();
	const state = options.state ?? createFileStateManager();

	const runtime = new ChannelRuntime({
		channels: channels.current(),
		handle: async (message) => agentResponse(state, message),
	});

	const replaceChannels = (nextChannels: Channel[]) => {
		channels.replace(nextChannels);
		runtime.replaceChannels(channels.current());
	};

	const core: RhoCore = {
		runtime,
		channels,
		files,
		state,
		handleMessage: async (message) => runtime.handle(message),
		loadConversation: async (key) => loadConversation(state, key),
		replaceChannels,
		reload: async () => reload({ runtime, channels, files }),
		activeChannelIds: () => channels.current().map((channel) => channel.id),
		close: async () => {
			await runtime.stop();
			sqlite.close();
		},
	};

	await core.reload();
	return core;
}

async function* agentResponse(
	state: StateManager,
	message: ChannelMessage,
): AsyncIterable<ChannelMessage> {
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
