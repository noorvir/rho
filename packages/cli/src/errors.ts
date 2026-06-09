export function formatAgentError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);

	if (message.includes("No API key found")) {
		return "No API key found for the selected model. Configure a model/API key for the Rho agent runtime, then try again.";
	}
	if (message.includes("No models available") || message.includes("No model")) {
		return "No model is configured for the Rho agent runtime. Configure a model and API key, then try again.";
	}

	return message;
}
