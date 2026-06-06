import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createAgentEventStream } from "./event-stream.ts";
import type { ConversationKey, StateManager } from "./state/types.ts";
import type { AgentEventStream } from "./types.ts";

export interface ConversationInput {
	state: StateManager;
	key: ConversationKey;
	message: AgentMessage;
	signal: AbortSignal;
}

export interface ConversationHistoryMessage {
	role: "user" | "assistant";
	text: string;
	timestamp: number;
}

export interface ConversationHistory {
	key: ConversationKey;
	messages: ConversationHistoryMessage[];
}

export function respondInConversation(input: ConversationInput): AgentEventStream {
	return createAgentEventStream((emit) => runConversation(input, emit));
}

export async function loadConversation(
	state: StateManager,
	key: ConversationKey,
): Promise<ConversationHistory> {
	const conversation = await state.resolve(key);
	const sessionManager = SessionManager.open(conversation.sessionFile);
	const context = sessionManager.buildSessionContext();

	return {
		key,
		messages: context.messages.flatMap((message) => {
			if (message.role !== "user" && message.role !== "assistant") {
				return [];
			}

			const text = messageText(message);
			if (!text) {
				return [];
			}

			return [{ role: message.role, text, timestamp: message.timestamp }];
		}),
	};
}

async function runConversation(
	input: ConversationInput,
	emit: (event: AgentEvent) => void,
): Promise<AgentMessage[]> {
	const agentDir = process.env.RHO_AGENT_DIR ?? getAgentDir();
	const conversation = await input.state.resolve(input.key);
	const sessionManager = SessionManager.open(conversation.sessionFile);
	const settingsManager = SettingsManager.create(process.cwd(), agentDir);
	const resourceLoader = new DefaultResourceLoader({
		cwd: process.cwd(),
		agentDir,
		settingsManager,
		noExtensions: true,
	});
	await resourceLoader.reload();

	const { session } = await createAgentSession({
		agentDir,
		sessionManager,
		settingsManager,
		resourceLoader,
		noTools: "all",
	});
	const unsubscribe = session.subscribe((event) => {
		if (isAgentEvent(event)) {
			emit(event);
		}
	});
	const abort = () => {
		void session.abort();
	};

	input.signal.addEventListener("abort", abort, { once: true });
	try {
		await session.prompt(messageText(input.message), { expandPromptTemplates: false });
		return session.state.messages;
	} finally {
		input.signal.removeEventListener("abort", abort);
		unsubscribe();
		session.dispose();
	}
}

function isAgentEvent(event: { type: string }): event is AgentEvent {
	return (
		event.type === "agent_start" ||
		event.type === "agent_end" ||
		event.type === "turn_start" ||
		event.type === "turn_end" ||
		event.type === "message_start" ||
		event.type === "message_update" ||
		event.type === "message_end" ||
		event.type === "tool_execution_start" ||
		event.type === "tool_execution_update" ||
		event.type === "tool_execution_end"
	);
}

function messageText(message: AgentMessage): string {
	if (message.role === "user") {
		return typeof message.content === "string"
			? message.content
			: message.content
					.filter((part) => part.type === "text")
					.map((part) => part.text)
					.join("\n");
	}

	if (message.role === "assistant") {
		return message.content
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("\n");
	}

	return "";
}
