import { stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { agentEventTextDelta, createRhoAgentSession, type RhoAgentSession } from "@rho/ai";
import { formatAgentError } from "./errors.ts";
import { getDefaultAgentDir } from "./paths.ts";
import { question } from "./prompt.ts";

export async function runAgentCommand(args: string[]): Promise<void> {
	const print = args[0] === "-p" || args[0] === "--print";
	const messageArgs = print ? args.slice(1) : args;
	const message = messageArgs.join(" ").trim();

	if (message) {
		await runOneShot(message);
		return;
	}

	if (print) {
		printAgentUsage();
		process.exitCode = 1;
		return;
	}

	await runInteractiveLoop();
}

export async function runOneShot(message: string): Promise<void> {
	const session = await createRhoAgentSession({ cwd: process.cwd(), agentDir: getDefaultAgentDir() });
	try {
		await streamPrompt(session, message);
	} finally {
		session.dispose();
	}
}

async function runInteractiveLoop(): Promise<void> {
	const session = await createRhoAgentSession({ cwd: process.cwd(), agentDir: getDefaultAgentDir() });
	const input = createInterface({ input: process.stdin, output: stdout });

	console.log("rho agent");
	console.log("Ask Rho to build, install, or manage Rho apps and extensions.");
	console.log("Type /exit to quit.\n");

	try {
		while (true) {
			const message = await question(input, "rho> ");
			if (message === undefined) {
				break;
			}

			const text = message.trim();
			if (!text) {
				continue;
			}
			if (text === "/exit" || text === "/quit") {
				break;
			}

			await streamPrompt(session, text);
		}
	} finally {
		input.close();
		session.dispose();
	}
}

async function streamPrompt(session: RhoAgentSession, message: string): Promise<void> {
	const stream = session.prompt(message);

	try {
		for await (const event of stream) {
			const delta = agentEventTextDelta(event);
			if (delta) {
				stdout.write(delta);
			}
		}
		await stream.result();
		stdout.write("\n");
	} catch (error) {
		console.error(`\nRho agent error: ${formatAgentError(error)}`);
	}
}

function printAgentUsage(): void {
	console.error(`Usage:
  rho agent
  rho agent -p "message"
  rho agent "message"`);
}
