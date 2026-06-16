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

// Client delegates for the rho-owned `_rho_*` tables that core itself
// depends on. Extensions and agents may evolve the rest of the schema, but a
// client that lost any of these is refused.
export const RHO_SYSTEM_MODELS = [
	"rho_sys_Task",
	"rho_sys_Cron",
	"rho_sys_Notification",
	"rho_sys_Owner",
	"rho_sys_Session",
	"rho_sys_ApiToken",
] as const;

/**
 * Throws when the client is missing any rho system model. Used as a tripwire
 * before swapping in a regenerated client, so a schema change that removed
 * system tables can never reach the running server.
 */
export function assertSystemModels(client: RhoPrisma): void {
	const missing = RHO_SYSTEM_MODELS.filter((model) => {
		const delegate: unknown = Reflect.get(client, model);
		return delegate === undefined || delegate === null;
	});
	if (missing.length > 0) {
		throw new Error(
			`Database client is missing rho system models: ${missing.join(", ")}. ` +
				"The _rho_* system tables are rho-owned and must never be removed from the schema.",
		);
	}
}

export interface ReloadableRhoPrismaOptions {
	/**
	 * Absolute directory of the generated Prisma client to import on reload.
	 * Installed runtimes pass their `db/generated/prisma` directory; without it
	 * the location is inferred from core's own source layout (dev repo).
	 */
	generatedClientDir?: string;
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

export function createReloadableRhoPrisma(
	databaseUrl: string,
	options: ReloadableRhoPrismaOptions = {},
): ReloadableRhoPrisma {
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
		const generated = generatedClient(options.generatedClientDir);
		const copyDir = join(reloadCopiesDir(), `reload-${process.pid}-${reloadCount}`);
		await cp(generated.dir, copyDir, { recursive: true });

		const moduleUrl = pathToFileURL(join(copyDir, generated.entry));
		const module: { PrismaClient: typeof PrismaClient } = await import(moduleUrl.href);
		const next = new module.PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });
		assertSystemModels(next);

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
function generatedClient(configuredDir?: string): { dir: string; entry: string } {
	if (configuredDir) {
		const entry = existsSync(join(configuredDir, "client.ts")) ? "client.ts" : "client.js";
		return { dir: configuredDir, entry };
	}

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
