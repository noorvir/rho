#!/usr/bin/env node

import { runAgentCommand, runOneShot } from "./agent-command.ts";
import { formatAgentError } from "./errors.ts";
import { runModelCommand } from "./model-command.ts";
import { runProviderCommand } from "./provider-command.ts";

export async function main(args = process.argv.slice(2)): Promise<void> {
	const [command, ...rest] = args;

	if (command === "agent") {
		await runAgentCommand(rest);
		return;
	}
	if (command === "provider") {
		await runProviderCommand(rest);
		return;
	}
	if (command === "model") {
		await runModelCommand(rest);
		return;
	}

	const text = args.join(" ").trim();
	if (text) {
		await runOneShot(text);
		return;
	}

	printUsage();
	process.exitCode = 1;
}

function printUsage(): void {
	console.error(`Usage:
  rho agent
  rho agent -p "message"
  rho agent "message"
  rho provider login codex
  rho model
  rho model provider/model
  rho "message"`);
}

await main().catch((error: unknown) => {
	console.error(`Rho agent error: ${formatAgentError(error)}`);
	process.exitCode = 1;
});
