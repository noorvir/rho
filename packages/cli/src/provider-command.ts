import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { loginRhoProvider, type RhoSubscriptionProvider } from "@rho/ai";
import { getDefaultAgentDir } from "./paths.ts";
import { question } from "./prompt.ts";

export async function runProviderCommand(args: string[]): Promise<void> {
	if (args[0] !== "login" || !args[1]) {
		printProviderUsage();
		process.exitCode = 1;
		return;
	}

	const provider = parseProvider(args[1]);
	if (!provider) {
		console.error(`Rho provider "${args[1]}" is not supported yet. Supported providers: codex`);
		process.exitCode = 1;
		return;
	}

	const input = createInterface({ input: stdin, output: stdout });
	try {
		const result = await loginRhoProvider(
			provider,
			{
				onAuth: (info) => {
					console.log("Open this URL in your browser to continue Rho provider login:");
					console.log(info.url);
					if (info.instructions) {
						console.log(info.instructions);
					}
				},
				onDeviceCode: (info) => {
					console.log("Open this URL in your browser:");
					console.log(info.verificationUri);
					console.log(`Enter this code: ${info.userCode}`);
				},
				onPrompt: (prompt) => question(input, `${prompt.message} `).then((value) => value ?? ""),
				onProgress: (message) => {
					console.log(message);
				},
				onManualCodeInput: () =>
					question(input, "Paste the authorization code or redirect URL: ").then((value) => value ?? ""),
				onSelect: async (prompt) => {
					console.log(prompt.message);
					for (const [index, option] of prompt.options.entries()) {
						console.log(`${index + 1}. ${option.label}`);
					}

					const answer = await question(input, "Select an option: ");
					const selectedIndex = Number(answer) - 1;
					return prompt.options[selectedIndex]?.id;
				},
			},
			{ agentDir: getDefaultAgentDir() },
		);

		console.log(`Logged in to ${result.providerName}.`);
		if (result.selectedModel) {
			console.log(`Selected model: ${result.selectedModel.provider}/${result.selectedModel.id}`);
		} else {
			console.log("No default model was selected. Run `rho model` to see available models.");
		}
		console.log(`Credentials saved in ${result.agentDir}.`);
	} finally {
		input.close();
	}
}

function parseProvider(provider: string): RhoSubscriptionProvider | undefined {
	return provider === "codex" ? provider : undefined;
}

function printProviderUsage(): void {
	console.error(`Usage:
  rho provider login codex`);
}
