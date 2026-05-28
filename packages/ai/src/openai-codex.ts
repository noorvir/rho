import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Agent as PiAgent } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";
import { getOAuthApiKey, type OAuthCredentials } from "@earendil-works/pi-ai/oauth";
import { createAgentEventStream } from "./event-stream.ts";
import type { Agent, AgentEventStream, AgentInput } from "./types.ts";

const OPENAI_CODEX_PROVIDER = "openai-codex";

export type OpenAICodexModel =
	| "gpt-5.2"
	| "gpt-5.3-codex"
	| "gpt-5.3-codex-spark"
	| "gpt-5.4"
	| "gpt-5.4-mini"
	| "gpt-5.5";

export interface OpenAICodexAgentOptions {
	model: OpenAICodexModel;
	authPath: string;
}

export class OpenAICodexAgent implements Agent {
	private readonly model: OpenAICodexModel;
	private readonly authPath: string;
	private auth: Record<string, OAuthCredentials> | undefined;

	constructor(options: OpenAICodexAgentOptions = defaultOptions()) {
		this.model = options.model;
		this.authPath = options.authPath;
	}

	respond(input: AgentInput): AgentEventStream {
		return createAgentEventStream(async (emit) => {
			const agent = new PiAgent({
				initialState: {
					model: getModel(OPENAI_CODEX_PROVIDER, this.model),
					thinkingLevel: "medium",
				},
				getApiKey: (provider) => this.getApiKey(provider),
				transport: "sse",
			});
			const unsubscribe = agent.subscribe((event) => emit(event));
			const abort = () => agent.abort();

			input.signal.addEventListener("abort", abort, { once: true });
			try {
				await agent.prompt(input.messages);
				return agent.state.messages;
			} finally {
				input.signal.removeEventListener("abort", abort);
				unsubscribe();
			}
		});
	}

	private async getApiKey(provider: string): Promise<string | undefined> {
		if (provider !== OPENAI_CODEX_PROVIDER) return undefined;

		const auth = this.loadAuth();
		const result = await getOAuthApiKey(OPENAI_CODEX_PROVIDER, auth);
		if (!result) {
			throw new Error(`Not logged in to ${OPENAI_CODEX_PROVIDER}`);
		}

		auth[OPENAI_CODEX_PROVIDER] = { type: "oauth", ...result.newCredentials };
		writeFileSync(this.authPath, `${JSON.stringify(auth, null, 2)}\n`);
		return result.apiKey;
	}

	private loadAuth(): Record<string, OAuthCredentials> {
		if (this.auth) return this.auth;
		if (!existsSync(this.authPath)) {
			throw new Error(`Missing Pi auth file: ${this.authPath}`);
		}

		this.auth = JSON.parse(readFileSync(this.authPath, "utf8")) as Record<string, OAuthCredentials>;
		return this.auth;
	}
}

function defaultOptions(): OpenAICodexAgentOptions {
	return {
		model: readModel(),
		authPath: process.env.RHO_PI_AUTH_PATH ?? `${process.env.HOME}/.pi/agent/auth.json`,
	};
}

function readModel(): OpenAICodexModel {
	const model = process.env.RHO_OPENAI_CODEX_MODEL;
	if (isOpenAICodexModel(model)) return model;
	return "gpt-5.5";
}

function isOpenAICodexModel(value: string | undefined): value is OpenAICodexModel {
	return (
		value === "gpt-5.2" ||
		value === "gpt-5.3-codex" ||
		value === "gpt-5.3-codex-spark" ||
		value === "gpt-5.4" ||
		value === "gpt-5.4-mini" ||
		value === "gpt-5.5"
	);
}
