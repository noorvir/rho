import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/prisma/client.ts";

export type RhoPrisma = PrismaClient;

export function createRhoPrisma(databaseUrl: string): RhoPrisma {
	return new PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });
}

export interface ReloadableRhoPrisma {
	/** Stable client reference; safe to capture for the process lifetime. */
	client: RhoPrisma;
	/**
	 * Re-imports the regenerated client and swaps it in behind `client`, so a
	 * running server picks up new models without a restart. On failure the
	 * current client stays untouched.
	 */
	reload(): Promise<void>;
}

let reloadCount = 0;

export function createReloadableRhoPrisma(databaseUrl: string): ReloadableRhoPrisma {
	let current = createRhoPrisma(databaseUrl);
	let currentCopyDir: string | undefined;

	const client = new Proxy(current, {
		get(_target, property) {
			const value = Reflect.get(current, property, current);
			if (typeof value === "function") {
				return value.bind(current);
			}
			return value;
		},
	});

	// Copies left behind by previous processes are never referenced again.
	const initialCleanup = rm(reloadCopiesDir(), { recursive: true, force: true }).catch(() => {});

	async function reload(): Promise<void> {
		await initialCleanup;
		reloadCount += 1;

		// The module cache would serve stale internals on repeat imports, even
		// with a cache-busted entry specifier, so each reload imports a fresh
		// copy of the generated client — a new module graph end to end. The
		// copy lives inside the package so bare imports still resolve.
		const generated = generatedClient();
		const copyDir = join(reloadCopiesDir(), `reload-${process.pid}-${reloadCount}`);
		await cp(generated.dir, copyDir, { recursive: true });

		const moduleUrl = pathToFileURL(join(copyDir, generated.entry));
		const module: { PrismaClient: typeof PrismaClient } = await import(moduleUrl.href);
		const next = new module.PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });

		const previous = current;
		const previousCopyDir = currentCopyDir;
		current = next;
		currentCopyDir = copyDir;

		await previous.$disconnect();
		if (previousCopyDir) {
			await rm(previousCopyDir, { recursive: true, force: true }).catch(() => {});
		}
	}

	return { client, reload };
}

function reloadCopiesDir(): string {
	return fileURLToPath(new URL("../.prisma-reload", import.meta.url));
}

// The static import above is resolved once at startup; reloads need the
// latest generated code. Prefer the TypeScript source, which
// `prisma generate` writes directly; the compiled copy in dist/ only
// refreshes on a package build.
function generatedClient(): { dir: string; entry: string } {
	if (import.meta.url.endsWith(".ts")) {
		const dir = fileURLToPath(new URL("./generated/prisma", import.meta.url));
		return { dir, entry: "client.ts" };
	}

	const source = fileURLToPath(new URL("../src/generated/prisma", import.meta.url));
	if (existsSync(source)) {
		return { dir: source, entry: "client.ts" };
	}

	const dist = fileURLToPath(new URL("./generated/prisma", import.meta.url));
	return { dir: dist, entry: "client.js" };
}
