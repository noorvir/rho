#!/usr/bin/env bun

import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

interface UninstallOptions {
	sourceRoot: string;
	installDir: string;
	agentDir: string;
}

const PATH_BLOCK_START = "# >>> rho source install >>>";
const PATH_BLOCK_END = "# <<< rho source install <<<";
const LAUNCHER_MARKER = "# rho source launcher";

const options = resolveUninstallOptions(process.argv.slice(2));
const binPath = join(options.installDir, "rho");

removeLauncher(binPath);
removePathBlocks();
removePath(options.agentDir);
removePath(options.installDir);
removePath(options.sourceRoot);

console.log("Uninstalled rho source installation.");
console.log(`Removed source command path: ${binPath}`);
console.log(`Removed source settings path: ${options.agentDir}`);
console.log("Production Rho paths outside the source install root were not removed.");

function resolveUninstallOptions(args: string[]): UninstallOptions {
	let sourceRoot = resolve(process.env.RHO_SOURCE_ROOT ?? join(homedir(), ".rho", "source"));
	let installDir: string | undefined;
	let agentDir: string | undefined;

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
		}
	}

	return {
		sourceRoot,
		installDir: installDir ?? resolve(sourceRoot, "bin"),
		agentDir: agentDir ?? resolve(sourceRoot, "agent"),
	};
}

function removeLauncher(path: string): void {
	if (!existsSync(path)) {
		return;
	}

	const current = lstatSync(path);
	if (!current.isSymbolicLink() && !isSourceLauncher(path)) {
		throw new Error(`${path} exists but is not a Rho source launcher. Refusing to remove it.`);
	}

	rmSync(path);
}

function removePathBlocks(): void {
	for (const profile of candidateProfiles()) {
		if (!existsSync(profile)) {
			continue;
		}

		const current = readFileSync(profile, "utf-8");
		const next = removePathBlock(current);
		if (next !== current) {
			writeFileSync(profile, next);
			console.log(`Removed source PATH block from ${profile}.`);
		}
	}
}

function candidateProfiles(): string[] {
	return [
		join(homedir(), ".zshrc"),
		join(homedir(), ".bashrc"),
		join(homedir(), ".bash_profile"),
		join(homedir(), ".profile"),
		join(homedir(), ".config", "fish", "config.fish"),
	];
}

function removePathBlock(content: string): string {
	const pattern = new RegExp(`${escapeRegExp(PATH_BLOCK_START)}[\\s\\S]*?${escapeRegExp(PATH_BLOCK_END)}\\n?`, "g");
	return content.replace(pattern, "");
}

function isSourceLauncher(path: string): boolean {
	try {
		return readFileSync(path, "utf-8").includes(LAUNCHER_MARKER);
	} catch {
		return false;
	}
}

function removePath(path: string): void {
	if (existsSync(path)) {
		rmSync(path, { recursive: true, force: true });
	}
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
