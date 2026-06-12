import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createRhoAgentSession, type RhoAgentExtensionSource } from "./session.ts";

/** All paths must be absolute; entrypoints resolve relative input. */
export interface TaskSessionInput {
	/** Resume an existing task session when set; otherwise a new session is created. */
	sessionFile?: string;
	/** Directory for new task session files. */
	sessionsDir: string;
	cwd: string;
	agentDir: string;
	prompt: string;
	agentExtensions?: RhoAgentExtensionSource[];
	signal?: AbortSignal;
	/** Reports the session file as soon as the session exists, before any work runs. */
	onSession?: (sessionFile: string | undefined) => void;
}

export interface TaskSessionResult {
	sessionFile: string | undefined;
	/** Final assistant text of the run. */
	text: string;
}

/**
 * Runs one background-task agent turn in its own persistent pi session.
 * The session file is the durable checkpoint: passing it back in resumes the
 * task with its prior context intact.
 */
export async function runTaskSession(input: TaskSessionInput): Promise<TaskSessionResult> {
	const sessionManager = input.sessionFile
		? SessionManager.open(input.sessionFile)
		: SessionManager.create(input.cwd, input.sessionsDir);

	const session = await createRhoAgentSession({
		cwd: input.cwd,
		agentDir: input.agentDir,
		sessionManager,
		agentExtensions: input.agentExtensions,
	});
	// Task work is formulaic; medium thinking roughly halves per-turn latency
	// compared to the high level interactive chats may configure.
	session.setThinkingLevel("medium");
	input.onSession?.(session.sessionFile ?? sessionManager.getSessionFile());

	const abort = () => {
		void session.abort();
	};
	input.signal?.addEventListener("abort", abort, { once: true });

	try {
		const stream = session.prompt(input.prompt, { expandPromptTemplates: false });
		for await (const _event of stream) {
			// Consume the stream; the session file records everything.
		}
		const messages = await stream.result();

		return {
			sessionFile: session.sessionFile,
			text: lastAssistantText(messages),
		};
	} finally {
		input.signal?.removeEventListener("abort", abort);
		session.dispose();
	}
}

function lastAssistantText(messages: Array<{ role: string; content?: unknown }>): string {
	for (const message of [...messages].reverse()) {
		if (message.role !== "assistant" || !Array.isArray(message.content)) {
			continue;
		}

		const text = message.content
			.filter((part): part is { type: "text"; text: string } => part.type === "text")
			.map((part) => part.text)
			.join("\n")
			.trim();
		if (text) {
			return text;
		}
	}

	return "";
}
