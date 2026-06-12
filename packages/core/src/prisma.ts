import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

	const client = new Proxy(current, {
		get(_target, property) {
			const value = Reflect.get(current, property, current);
			if (typeof value === "function") {
				return value.bind(current);
			}
			return value;
		},
	});

	async function reload(): Promise<void> {
		reloadCount += 1;
		const moduleUrl = generatedClientUrl();
		moduleUrl.searchParams.set("reload", String(reloadCount));

		const generated: { PrismaClient: typeof PrismaClient } = await import(moduleUrl.href);
		const next = new generated.PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });

		const previous = current;
		current = next;
		await previous.$disconnect();
	}

	return { client, reload };
}

// The static import above is resolved once at startup, so a regenerated
// client needs a fresh, cache-busted dynamic import. Prefer the TypeScript
// source, which `prisma generate` writes directly; the compiled copy in
// dist/ only refreshes on a package build.
function generatedClientUrl(): URL {
	if (import.meta.url.endsWith(".ts")) {
		return new URL("./generated/prisma/client.ts", import.meta.url);
	}

	const source = new URL("../src/generated/prisma/client.ts", import.meta.url);
	if (existsSync(fileURLToPath(source))) {
		return source;
	}
	return new URL("./generated/prisma/client.js", import.meta.url);
}
