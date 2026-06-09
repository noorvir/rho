import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import {
	createAgentSession,
	DefaultResourceLoader,
	type ExtensionFactory,
	type AgentSession as PiAgentSession,
	type SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createAgentEventStream } from "./event-stream.ts";
import type { AgentEventStream } from "./types.ts";

export interface RhoAgentSessionOptions {
	cwd: string;
	agentDir: string;
	sessionManager?: SessionManager;
	agentExtensions?: RhoAgentExtensionSource[];
}

export type RhoAgentExtensionSource =
	| { type: "path"; path: string }
	| { type: "factory"; factory: ExtensionFactory };

export interface RhoAgentPromptOptions {
	signal?: AbortSignal;
	expandPromptTemplates?: boolean;
}

export interface RhoAgentSession {
	readonly sessionId: string;
	readonly sessionFile: string | undefined;
	prompt(text: string, options?: RhoAgentPromptOptions): AgentEventStream;
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
		extensionFactories,
		systemPrompt: getRhoSystemPrompt(),
	});
	await resourceLoader.reload();

	const { session } = await createAgentSession({
		cwd,
		agentDir,
		settingsManager,
		resourceLoader,
		sessionManager: options.sessionManager,
	});
	await session.bindExtensions({});

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

function getRhoSystemPrompt(): string {
	return `You are the Rho agent, an expert coding assistant for building, editing, installing, and managing Rho apps, extensions, runtime files, and documentation.

Rho uses an underlying agent engine for model calls, sessions, tools, resource loading, and extension execution. Do not identify yourself as that engine. In user-facing responses, present yourself as Rho.

Available tools are provided by the runtime. Use them carefully to inspect files, run focused commands, edit code, and validate changes.

Before changing Rho internals, extension behavior, app behavior, database behavior, filesystem conventions, install behavior, or security behavior, read docs/index.md and then the relevant Rho docs in the documented order.

When helping users build Rho apps or extensions, use the Todo app as the running example unless the user asks for another domain. Prefer typed oRPC and React Query for normal app API calls. Treat rho.apiFetch() as a lower-level escape hatch.

For install decisions, ask normal users product-level questions with a recommended default. Do not ask schema/table/field questions unless the user chooses customization.

The installed runtime owns db/schema.prisma, db/rho.sqlite, and db/generated/. Schema changes should go through approved Rho-managed Prisma migrations.

Be concise. Show file paths clearly when working with files.`;
}
