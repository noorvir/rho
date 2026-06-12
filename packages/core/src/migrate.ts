import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createRhoDatabase } from "./sqlite.ts";

const require = createRequire(import.meta.url);

export interface MigrateRuntimeSchemaOptions {
	/** Absolute runtime db directory containing schema.prisma, prisma.config.ts, and migrations/. */
	dbDir: string;
	/** Live database URL, for example `file:/path/to/rho.sqlite`. */
	databaseUrl: string;
}

/**
 * Applies a runtime schema change safely: creates the migration and applies
 * it to a snapshot copy of the live database first, then applies the
 * validated migration to the live database and regenerates the client.
 * Throws without touching the live database when validation fails. The
 * caller reloads the runtime afterwards to swap the regenerated client in.
 */
export async function migrateRuntimeSchema(
	options: MigrateRuntimeSchemaOptions,
	name: string,
): Promise<string> {
	const migrationName = name
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
	if (!migrationName) {
		throw new Error("Migration name must contain letters or numbers");
	}

	const copyPath = join(options.dbDir, `.migrate-validate-${Date.now()}.sqlite`);
	await snapshotDatabase(options.databaseUrl, copyPath);

	try {
		prisma(options.dbDir, `file:${copyPath}`, ["migrate", "dev", "--name", migrationName]);
		prisma(options.dbDir, options.databaseUrl, ["migrate", "deploy"]);
		// migrate dev does not reliably run generators; regenerate explicitly so
		// the reload that follows picks up the new models.
		prisma(options.dbDir, options.databaseUrl, ["generate"]);
	} finally {
		await rm(copyPath, { force: true }).catch(() => {});
	}

	return `Migration ${migrationName} validated on a copy and applied to the live database.`;
}

async function snapshotDatabase(databaseUrl: string, copyPath: string): Promise<void> {
	const database = createRhoDatabase(databaseUrl);
	try {
		await database.execute(`VACUUM INTO '${copyPath.replaceAll("'", "''")}'`);
	} finally {
		database.close();
	}
}

function prisma(dbDir: string, databaseUrl: string, args: string[]): void {
	const prismaPackage = require.resolve("prisma/package.json");
	const prismaBin = join(dirname(prismaPackage), "build", "index.js");

	const result = spawnSync(
		process.execPath,
		[prismaBin, ...args, "--config", join(dbDir, "prisma.config.ts")],
		{
			cwd: dbDir,
			env: { ...process.env, DATABASE_URL: databaseUrl },
			encoding: "utf8",
		},
	);
	if (result.status !== 0) {
		const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
		throw new Error(`prisma ${args.join(" ")} failed:\n${output.slice(-1500)}`);
	}
}
