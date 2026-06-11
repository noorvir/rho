import type { Api, Model } from "@earendil-works/pi-ai";
import { AuthStorage, ModelRegistry, SettingsManager } from "@earendil-works/pi-coding-agent";
import { RhoAgent } from "./agent.ts";

export interface RhoAgentConfigOptions {
	/** Absolute agent config directory (auth.json, models.json, settings.json). */
	agentDir: string;
}

export async function createRhoAgent(options: RhoAgentConfigOptions): Promise<RhoAgent> {
	const agentDir = options.agentDir;
	const authStorage = AuthStorage.create(`${agentDir}/auth.json`);
	const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
	const settings = SettingsManager.create(agentDir, agentDir);
	await settings.reload();

	const model = resolveModel(modelRegistry, settings.getDefaultProvider(), settings.getDefaultModel());
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
		if (configured) {
			return configured;
		}
	}

	return modelRegistry.getAvailable()[0];
}
