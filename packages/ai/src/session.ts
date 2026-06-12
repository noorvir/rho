import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	type ExtensionFactory,
	ModelRegistry,
	type AgentSession as PiAgentSession,
	type SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createAgentEventStream } from "./event-stream.ts";
import { getRhoSystemPrompt, type RhoPromptRole, rhoSystemPromptExtension } from "./system-prompt.ts";
import type { AgentEventStream } from "./types.ts";

export interface RhoAgentSessionOptions {
	/** Absolute working directory; tools run and project config is discovered here. */
	cwd: string;
	/** Absolute agent config directory (auth.json, models.json, settings.json). */
	agentDir: string;
	sessionManager?: SessionManager;
	agentExtensions?: RhoAgentExtensionSource[];
	/** Overrides the settings-default model for this session. */
	model?: RhoAgentModelRef;
	/** Allowlist of built-in tool names; extension tools stay enabled. */
	tools?: string[];
	/** Tool names to disable, applied after the allowlist. */
	excludeTools?: string[];
	/** Prompt variant: channels get orchestration-only knowledge. Defaults to full. */
	role?: RhoPromptRole;
}

export type RhoAgentExtensionSource =
	| { type: "path"; path: string }
	| { type: "factory"; factory: ExtensionFactory };

export interface RhoAgentPromptOptions {
	signal?: AbortSignal;
	expandPromptTemplates?: boolean;
}

export interface RhoAgentModelRef {
	provider: string;
	modelId: string;
}

export interface RhoAgentSession {
	readonly sessionId: string;
	readonly sessionFile: string | undefined;
	prompt(text: string, options?: RhoAgentPromptOptions): AgentEventStream;
	setThinkingLevel(level: "minimal" | "low" | "medium" | "high"): void;
	abort(): Promise<void>;
	dispose(): void;
}

export async function createRhoAgentSession(options: RhoAgentSessionOptions): Promise<RhoAgentSession> {
	const cwd = options.cwd;
	const agentDir = options.agentDir;
	const settingsManager = SettingsManager.create(cwd, agentDir);
	await settingsManager.reload();

	const { extensionPaths, extensionFactories } = collectAgentExtensionSources(options.agentExtensions ?? []);
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager,
		additionalExtensionPaths: extensionPaths,
		extensionFactories: [rhoSystemPromptExtension, ...extensionFactories],
		systemPrompt: getRhoSystemPrompt(options.role),
	});
	await resourceLoader.reload();

	const { session } = await createAgentSession({
		tools: options.tools,
		excludeTools: options.excludeTools,
		cwd,
		agentDir,
		settingsManager,
		resourceLoader,
		sessionManager: options.sessionManager,
	});
	await session.bindExtensions({});

	if (options.model) {
		const authStorage = AuthStorage.create(`${agentDir}/auth.json`);
		const registry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
		const model = registry.find(options.model.provider, options.model.modelId);
		if (!model) {
			throw new Error(`Configured session model not found: ${options.model.provider}/${options.model.modelId}`);
		}
		await session.setModel(model);
	}

	return {
		get sessionId() {
			return session.sessionId;
		},
		get sessionFile() {
			return session.sessionFile;
		},
		prompt(text, promptOptions) {
			return createAgentEventStream((emit) => runPrompt(session, text, promptOptions ?? {}, emit));
		},
		setThinkingLevel(level) {
			session.setThinkingLevel(level);
		},
		abort() {
			return session.abort();
		},
		dispose() {
			session.dispose();
		},
	};
}

function collectAgentExtensionSources(sources: RhoAgentExtensionSource[]): {
	extensionPaths: string[];
	extensionFactories: ExtensionFactory[];
} {
	const extensionPaths: string[] = [];
	const extensionFactories: ExtensionFactory[] = [];

	for (const source of sources) {
		if (source.type === "path") {
			extensionPaths.push(source.path);
		} else {
			extensionFactories.push(source.factory);
		}
	}

	return { extensionPaths, extensionFactories };
}

async function runPrompt(
	session: PiAgentSession,
	text: string,
	options: RhoAgentPromptOptions,
	emit: (event: AgentEvent) => void,
): Promise<AgentMessage[]> {
	const unsubscribe = session.subscribe((event) => {
		if (isAgentEvent(event)) {
			emit(event);
		}
	});
	const abort = () => {
		void session.abort();
	};

	options.signal?.addEventListener("abort", abort, { once: true });
	try {
		await session.prompt(text, {
			expandPromptTemplates: options.expandPromptTemplates ?? true,
			source: "rpc",
		});
		return session.state.messages;
	} finally {
		options.signal?.removeEventListener("abort", abort);
		unsubscribe();
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
