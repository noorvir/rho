import type { Api, Model } from "@earendil-works/pi-ai";
import {
	AuthStorage,
	getAgentDir,
	ModelRegistry,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { RhoAgent } from "./agent.ts";

export interface RhoAgentConfigOptions {
	cwd?: string;
	agentDir?: string;
}

export async function createRhoAgent(options: RhoAgentConfigOptions = {}): Promise<RhoAgent> {
	const cwd = options.cwd ?? process.cwd();
	const agentDir = options.agentDir ?? getAgentDir();
	const authStorage = AuthStorage.create(`${agentDir}/auth.json`);
	const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
	const settings = SettingsManager.create(cwd, agentDir);
	await settings.reload();

	const model = resolveModel(
		modelRegistry,
		settings.getDefaultProvider(),
		settings.getDefaultModel(),
	);
	if (!model) {
		throw new Error("No rho agent model configured. Use pi /model or /login to configure one.");
	}

	return new RhoAgent({
		initialState: {
			model,
			thinkingLevel: settings.getDefaultThinkingLevel() ?? "medium",
		},
		getApiKey: (provider) => authStorage.getApiKey(provider),
		transport: settings.getTransport(),
	});
}

function resolveModel(
	modelRegistry: ModelRegistry,
	provider: string | undefined,
	modelId: string | undefined,
): Model<Api> | undefined {
	if (provider && modelId) {
		const configured = modelRegistry.find(provider, modelId);
		if (configured) return configured;
	}

	return modelRegistry.getAvailable()[0];
}
