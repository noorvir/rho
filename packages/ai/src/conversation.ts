import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import type { ImageContent } from "@earendil-works/pi-ai";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createAgentEventStream } from "./event-stream.ts";
import { createRhoAgentSession, type RhoAgentExtensionSource } from "./session.ts";
import type { ConversationKey, StateManager } from "./state/types.ts";
import type { AgentEventStream } from "./types.ts";

export interface ConversationInput {
	state: StateManager;
	key: ConversationKey;
	cwd: string;
	agentDir: string;
	message: AgentMessage;
	signal: AbortSignal;
	agentExtensions?: RhoAgentExtensionSource[];
}

export interface ConversationHistoryMessage {
	role: "user" | "assistant";
	text: string;
	timestamp: number;
	attachments: ConversationAttachment[];
}

/** A store-relative file reference recorded on a user turn via an `[attachment: ...]` line. */
export interface ConversationAttachment {
	path: string;
	mimeType: string;
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
			if (message.role === "custom" && message.display) {
				const text = customMessageText(message.content);
				return text ? [{ role: "assistant" as const, text, timestamp: message.timestamp, attachments: [] }] : [];
			}

			if (message.role !== "user" && message.role !== "assistant") {
				return [];
			}

			const { text, attachments } = splitAttachmentLines(messageText(message));
			if (!text && attachments.length === 0) {
				return [];
			}

			return [{ role: message.role, text, timestamp: message.timestamp, attachments }];
		}),
	};
}

/**
 * Appends a runtime-authored message to a conversation outside any agent
 * turn, for example a background task outcome. The message shows up in
 * conversation history and in the model context of later turns.
 */
export async function appendConversationMessage(
	state: StateManager,
	key: ConversationKey,
	message: { customType: string; text: string; details?: unknown },
): Promise<void> {
	const conversation = await state.resolve(key);
	const sessionManager = SessionManager.open(conversation.sessionFile);
	sessionManager.appendCustomMessageEntry(message.customType, message.text, true, message.details);
}

function customMessageText(content: string | Array<{ type: string; text?: string }>): string {
	if (typeof content === "string") {
		return content;
	}
	return content
		.filter(
			(part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string",
		)
		.map((part) => part.text)
		.join("\n");
}

async function runConversation(
	input: ConversationInput,
	emit: (event: AgentEvent) => void,
): Promise<AgentMessage[]> {
	const conversation = await input.state.resolve(input.key);
	const sessionManager = SessionManager.open(conversation.sessionFile);

	// Channel turns handle conversation and data directly but never structural
	// change: the channel prompt carries no build knowledge, and the
	// schema/extension tools are implementer-only so the workflow cannot be
	// pattern-matched inline.
	const session = await createRhoAgentSession({
		cwd: input.cwd,
		agentDir: input.agentDir,
		sessionManager,
		agentExtensions: input.agentExtensions,
		role: "channel",
		excludeTools: ["rho_migrate", "rho_validate_schema", "rho_reload"],
	});
	const abort = () => {
		void session.abort();
	};

	input.signal.addEventListener("abort", abort, { once: true });
	try {
		const images = messageImages(input.message);
		const stream = session.prompt(messageText(input.message), {
			expandPromptTemplates: false,
			images: images.length > 0 ? images : undefined,
		});
		for await (const event of stream) {
			emit(event);
		}
		return await stream.result();
	} finally {
		input.signal.removeEventListener("abort", abort);
		session.dispose();
	}
}

const attachmentLinePattern = /^\[attachment: (.+) \(([^()]+)\)\]$/;

/**
 * Separates `[attachment: <path> (<mime>)]` lines from a turn's display text.
 * The lines stay in the agent transcript; clients get them back as structured
 * attachment references instead.
 */
function splitAttachmentLines(text: string): { text: string; attachments: ConversationAttachment[] } {
	const attachments: ConversationAttachment[] = [];
	const lines: string[] = [];

	for (const line of text.split("\n")) {
		const match = line.match(attachmentLinePattern);
		if (match) {
			attachments.push({ path: match[1], mimeType: match[2] });
		} else {
			lines.push(line);
		}
	}

	return { text: lines.join("\n").trim(), attachments };
}

function messageImages(message: AgentMessage): ImageContent[] {
	if (message.role !== "user" || typeof message.content === "string") {
		return [];
	}

	return message.content.filter((part): part is ImageContent => part.type === "image");
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
