#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

interface InstallOptions {
	sourceRoot: string;
	installDir: string;
	agentDir: string;
	pathMode: "ask" | "add" | "skip";
}

const PATH_BLOCK_START = "# >>> rho source install >>>";
const PATH_BLOCK_END = "# <<< rho source install <<<";
const LAUNCHER_MARKER = "# rho source launcher";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const options = resolveInstallOptions(process.argv.slice(2));
const binPath = join(options.installDir, "rho");
const cliPath = join(repoRoot, "packages", "cli", "dist", "cli.js");

run("bun", ["install"], repoRoot);
run("bun", ["run", "build"], repoRoot);

if (!existsSync(cliPath)) {
	throw new Error(`Rho CLI build output was not found at ${cliPath}`);
}

mkdirSync(options.installDir, { recursive: true });
mkdirSync(options.agentDir, { recursive: true });
writeLauncher(binPath, cliPath, options.agentDir);
chmodSync(cliPath, 0o755);

console.log("Installed rho from source:");
console.log(`  command: ${binPath}`);
console.log(`  runtime: ${cliPath}`);
console.log(`  source settings: ${options.agentDir}`);
console.log("");

await maybeAddToPath(options.installDir, options.pathMode);

function resolveInstallOptions(args: string[]): InstallOptions {
	let sourceRoot = resolve(process.env.RHO_SOURCE_ROOT ?? join(homedir(), ".rho", "source"));
	let installDir: string | undefined;
	let agentDir: string | undefined;
	let pathMode: InstallOptions["pathMode"] = "ask";

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--source-root") {
			const value = args[index + 1];
			if (!value) {
				throw new Error("--source-root requires a directory.");
			}
			sourceRoot = resolve(value);
			index += 1;
		} else if (arg === "--prefix" || arg === "--install-dir") {
			const value = args[index + 1];
			if (!value) {
				throw new Error(`${arg} requires a directory.`);
			}
			installDir = resolve(value);
			index += 1;
		} else if (arg === "--agent-dir") {
			const value = args[index + 1];
			if (!value) {
				throw new Error("--agent-dir requires a directory.");
			}
			agentDir = resolve(value);
			index += 1;
		} else if (arg === "--add-to-path") {
			pathMode = "add";
		} else if (arg === "--no-add-to-path") {
			pathMode = "skip";
		}
	}

	return {
		sourceRoot,
		installDir: installDir ?? resolve(sourceRoot, "bin"),
		agentDir: agentDir ?? resolve(sourceRoot, "agent"),
		pathMode,
	};
}

async function maybeAddToPath(path: string, mode: InstallOptions["pathMode"]): Promise<void> {
	if (isOnPath(path)) {
		console.log(`${path} is already on PATH.`);
		return;
	}

	const profile = detectShellProfile();
	if (!profile) {
		printPathInstructions(path);
		return;
	}

	if (mode === "skip") {
		printPathInstructions(path);
		return;
	}

	let shouldAdd = mode === "add";
	if (mode === "ask") {
		if (!stdin.isTTY || !stdout.isTTY) {
			printPathInstructions(path);
			return;
		}

		const input = createInterface({ input: stdin, output: stdout });
		try {
			const answer = await input.question(`Add ${path} to PATH in ${profile.path}? [Y/n] `);
			shouldAdd = answer.trim().toLowerCase() !== "n";
		} finally {
			input.close();
		}
	}

	if (!shouldAdd) {
		printPathInstructions(path);
		return;
	}

	addPathToProfile(path, profile);
	console.log(`Added ${path} to PATH in ${profile.path}.`);
	console.log("Restart your shell or run:");
	console.log(`  source ${profile.path}`);
}

function isOnPath(path: string): boolean {
	const paths = (process.env.PATH ?? "").split(":").map((entry) => resolve(entry));
	return paths.includes(resolve(path));
}

function detectShellProfile(): { shell: string; path: string } | undefined {
	const shell = basename(process.env.SHELL ?? "");
	if (shell === "zsh") {
		return { shell, path: join(homedir(), ".zshrc") };
	}
	if (shell === "bash") {
		const bashrc = join(homedir(), ".bashrc");
		return { shell, path: existsSync(bashrc) ? bashrc : join(homedir(), ".bash_profile") };
	}
	if (shell === "fish") {
		return { shell, path: join(homedir(), ".config", "fish", "config.fish") };
	}
	if (process.env.SHELL) {
		return { shell, path: join(homedir(), ".profile") };
	}
	return undefined;
}

function addPathToProfile(path: string, profile: { shell: string; path: string }): void {
	const block = pathBlock(path, profile.shell);
	const current = existsSync(profile.path) ? readFileSync(profile.path, "utf-8") : "";
	const withoutOldBlock = removePathBlock(current);

	mkdirSync(dirname(profile.path), { recursive: true });
	writeFileSync(
		profile.path,
		`${withoutOldBlock.endsWith("\n") || withoutOldBlock.length === 0 ? withoutOldBlock : `${withoutOldBlock}\n`}${block}`,
	);
}

function removePathBlock(content: string): string {
	const pattern = new RegExp(`${escapeRegExp(PATH_BLOCK_START)}[\\s\\S]*?${escapeRegExp(PATH_BLOCK_END)}\\n?`, "g");
	return content.replace(pattern, "");
}

function pathBlock(path: string, shell: string): string {
	const quotedPath = shellSingleQuote(path);
	if (shell === "fish") {
		return `${PATH_BLOCK_START}\nset -gx PATH ${quotedPath} $PATH\n${PATH_BLOCK_END}\n`;
	}

	return `${PATH_BLOCK_START}\nexport PATH=${quotedPath}:$PATH\n${PATH_BLOCK_END}\n`;
}

function writeLauncher(path: string, cliPath: string, agentDir: string): void {
	if (existsSync(path)) {
		const current = lstatSync(path);
		if (!current.isSymbolicLink() && !isSourceLauncher(path)) {
			throw new Error(`${path} already exists and is not a Rho source launcher. Remove it or choose --install-dir.`);
		}
		rmSync(path);
	}

	writeFileSync(
		path,
		`#!/usr/bin/env bash\n${LAUNCHER_MARKER}\nif [ -z "\${RHO_AGENT_DIR:-}" ]; then\n  export RHO_AGENT_DIR=${shellSingleQuote(agentDir)}\nfi\nexec ${shellSingleQuote(cliPath)} "$@"\n`,
		{ mode: 0o755 },
	);
}

function isSourceLauncher(path: string): boolean {
	try {
		return readFileSync(path, "utf-8").includes(LAUNCHER_MARKER);
	} catch {
		return false;
	}
}

function shellSingleQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printPathInstructions(path: string): void {
	console.log("If this is your first install, make sure the source install directory is on PATH:");
	console.log(`  export PATH=${shellSingleQuote(path)}:$PATH`);
}

function run(command: string, args: string[], cwd: string): void {
	const result = spawnSync(command, args, {
		cwd,
		stdio: "inherit",
		env: process.env,
	});

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed.`);
	}
}
