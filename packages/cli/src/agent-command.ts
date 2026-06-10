import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { stdout } from "node:process";
import { fileURLToPath } from "node:url";
import {
	agentEventTextDelta,
	createRhoAgentSession,
	getRhoSystemPrompt,
	type RhoAgentSession,
} from "@rho/ai";
import { formatAgentError } from "./errors.ts";
import { getDefaultAgentDir } from "./paths.ts";

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

	await runInteractiveTui();
}

export async function runOneShot(message: string): Promise<void> {
	const session = await createRhoAgentSession({ cwd: process.cwd(), agentDir: getDefaultAgentDir() });
	try {
		await streamPrompt(session, message);
	} finally {
		session.dispose();
	}
}

async function runInteractiveTui(): Promise<void> {
	await runTuiCommand(["--append-system-prompt", getRhoSystemPrompt()]);
}

// Runs the Rho agent terminal binary directly. Package management commands
// (install/remove) reuse its built-in package manager against the Rho agent dir.
export async function runTuiCommand(args: string[]): Promise<void> {
	const cliPath = getTuiCliPath();
	const child = spawn(process.execPath, [cliPath, ...args], {
		stdio: "inherit",
		env: {
			...process.env,
			RHO_CODING_AGENT_DIR: getDefaultAgentDir(),
			// Rho owns the update story for the repacked TUI; suppress pi's
			// pi.dev version check and its `rho update` self-update prompt.
			PI_SKIP_VERSION_CHECK: "1",
		},
	});

	const exitCode = await new Promise<number>((resolve, reject) => {
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			resolve(signal ? 1 : (code ?? 1));
		});
	});

	if (exitCode !== 0) {
		process.exitCode = exitCode;
	}
}

function getTuiCliPath(): string {
	const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
	const cliPath = join(packageDir, "tui", "dist", "cli.js");
	if (!existsSync(cliPath)) {
		throw new Error(`Rho agent terminal is not built at ${cliPath}. Run: bun run build`);
	}

	return cliPath;
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
