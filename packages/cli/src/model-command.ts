import { listRhoModels, selectRhoModel } from "@rho/ai";
import { getDefaultAgentDir } from "./paths.ts";

export async function runModelCommand(args: string[]): Promise<void> {
	const modelReference = args.join(" ").trim();
	if (modelReference) {
		const reference = parseModelReference(modelReference);
		if (!reference) {
			console.error("Use `rho model provider/model`, for example `rho model openai-codex/gpt-5.1-codex`.");
			process.exitCode = 1;
			return;
		}

		const result = await selectRhoModel(reference, { agentDir: getDefaultAgentDir() });
		console.log(`Selected Rho model: ${result.model.provider}/${result.model.id}`);
		console.log(`Settings saved in ${result.agentDir}.`);
		return;
	}

	const models = await listRhoModels({ agentDir: getDefaultAgentDir() });
	if (models.length === 0) {
		console.log(
			"No Rho models are available yet. Run `rho provider login codex` or configure an API key provider.",
		);
		return;
	}

	for (const model of models) {
		const marker = model.selected ? "*" : " ";
		console.log(`${marker} ${model.provider}/${model.id} - ${model.name}`);
	}
}

function parseModelReference(reference: string): { provider: string; modelId: string } | undefined {
	const [provider, modelId] = reference.split("/", 2);
	if (!provider || !modelId) {
		return undefined;
	}

	return { provider, modelId };
}
