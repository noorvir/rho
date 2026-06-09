import { join } from "node:path";
import type { OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import { AuthStorage, ModelRegistry, SettingsManager } from "@earendil-works/pi-coding-agent";

export type RhoSubscriptionProvider = "codex";

export interface RhoAgentProviderConfig {
	agentDir: string;
}

export interface RhoModelReference {
	provider: string;
	modelId: string;
}

export interface RhoModelInfo {
	provider: string;
	id: string;
	name: string;
	selected: boolean;
}

export interface RhoProviderLoginResult {
	provider: string;
	providerName: string;
	selectedModel: RhoModelInfo | undefined;
	agentDir: string;
}

export interface RhoModelSelectionResult {
	model: RhoModelInfo;
	agentDir: string;
}

export async function loginRhoProvider(
	provider: RhoSubscriptionProvider,
	callbacks: OAuthLoginCallbacks,
	options: RhoAgentProviderConfig,
): Promise<RhoProviderLoginResult> {
	const services = await createRhoModelServices(options);
	const providerId = rhoProviderId(provider);
	const oauthProvider = services.authStorage
		.getOAuthProviders()
		.find((candidate) => candidate.id === providerId);
	if (!oauthProvider) {
		throw new Error(`Provider "${provider}" is not available for Rho subscription login.`);
	}

	await services.authStorage.login(oauthProvider.id, callbacks);
	services.modelRegistry.refresh();

	let selectedModel = currentModel(services);
	if (!selectedModel) {
		selectedModel = await selectFirstProviderModel(services, oauthProvider.id);
	}

	return {
		provider: oauthProvider.id,
		providerName: oauthProvider.name,
		selectedModel,
		agentDir: services.agentDir,
	};
}

export async function listRhoModels(options: RhoAgentProviderConfig): Promise<RhoModelInfo[]> {
	const services = await createRhoModelServices(options);
	const defaultProvider = services.settingsManager.getDefaultProvider();
	const defaultModel = services.settingsManager.getDefaultModel();

	return services.modelRegistry.getAvailable().map((model) => ({
		provider: model.provider,
		id: model.id,
		name: model.name ?? model.id,
		selected: model.provider === defaultProvider && model.id === defaultModel,
	}));
}

export async function selectRhoModel(
	reference: RhoModelReference,
	options: RhoAgentProviderConfig,
): Promise<RhoModelSelectionResult> {
	const services = await createRhoModelServices(options);
	const model = services.modelRegistry.find(reference.provider, reference.modelId);
	if (!model || !services.modelRegistry.hasConfiguredAuth(model)) {
		throw new Error(`No available Rho model matches "${reference.provider}/${reference.modelId}".`);
	}

	services.settingsManager.setDefaultModelAndProvider(model.provider, model.id);
	await services.settingsManager.flush();

	return {
		model: {
			provider: model.provider,
			id: model.id,
			name: model.name ?? model.id,
			selected: true,
		},
		agentDir: services.agentDir,
	};
}

async function createRhoModelServices(options: RhoAgentProviderConfig): Promise<{
	agentDir: string;
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
	settingsManager: SettingsManager;
}> {
	const authStorage = AuthStorage.create(join(options.agentDir, "auth.json"));
	const modelRegistry = ModelRegistry.create(authStorage, join(options.agentDir, "models.json"));
	const settingsManager = SettingsManager.create(options.agentDir, options.agentDir);
	await settingsManager.reload();

	return { agentDir: options.agentDir, authStorage, modelRegistry, settingsManager };
}

function rhoProviderId(provider: RhoSubscriptionProvider): string {
	return provider === "codex" ? "openai-codex" : provider;
}

function currentModel(services: {
	modelRegistry: ModelRegistry;
	settingsManager: SettingsManager;
}): RhoModelInfo | undefined {
	const provider = services.settingsManager.getDefaultProvider();
	const modelId = services.settingsManager.getDefaultModel();
	if (!provider || !modelId) {
		return undefined;
	}

	const model = services.modelRegistry.find(provider, modelId);
	if (!model || !services.modelRegistry.hasConfiguredAuth(model)) {
		return undefined;
	}

	return {
		provider: model.provider,
		id: model.id,
		name: model.name ?? model.id,
		selected: true,
	};
}

async function selectFirstProviderModel(
	services: {
		modelRegistry: ModelRegistry;
		settingsManager: SettingsManager;
	},
	provider: string,
): Promise<RhoModelInfo | undefined> {
	const model = services.modelRegistry.getAvailable().find((candidate) => candidate.provider === provider);
	if (!model) {
		return undefined;
	}

	services.settingsManager.setDefaultModelAndProvider(model.provider, model.id);
	await services.settingsManager.flush();

	return {
		provider: model.provider,
		id: model.id,
		name: model.name ?? model.id,
		selected: true,
	};
}
