import { spawnSync } from "node:child_process";
import { readFile, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { RHO_SYSTEM_MODELS } from "./prisma.ts";
import { createRhoDatabase } from "./sqlite.ts";

const require = createRequire(import.meta.url);

export interface MigrateRuntimeSchemaOptions {
	/** Absolute runtime db directory containing schema.prisma, prisma.config.ts, and migrations/. */
	dbDir: string;
	/** Live database URL, for example `file:/path/to/rho.sqlite`. */
	databaseUrl: string;
}

/**
 * Validates a runtime schema change against a snapshot of the live database
 * without applying anything to the live database.
 */
export async function validateRuntimeSchema(
	options: MigrateRuntimeSchemaOptions,
	name: string,
): Promise<string> {
	const beforeMigrations = await migrationDirs(options.dbDir);
	const migrationName = await validateRuntimeSchemaChange(options, name, beforeMigrations);
	await removeCreatedMigrations(options.dbDir, beforeMigrations);

	return `Migration ${migrationName} validated on a copy; live database unchanged.`;
}

/**
 * Applies a runtime schema change safely: validates the migration on a
 * snapshot copy of the live database, rejects system-table changes before live
 * apply, then applies the validated migration to the live database and
 * regenerates the client. Throws without touching the live database when
 * validation fails. The caller reloads the runtime afterwards to swap the
 * regenerated client in.
 */
export async function migrateRuntimeSchema(
	options: MigrateRuntimeSchemaOptions,
	name: string,
): Promise<string> {
	const beforeMigrations = await migrationDirs(options.dbDir);
	const migrationName = await validateRuntimeSchemaChange(options, name, beforeMigrations);

	prisma(options.dbDir, options.databaseUrl, ["migrate", "deploy"]);
	// migrate dev does not reliably run generators; regenerate explicitly so
	// the reload that follows picks up the new models.
	prisma(options.dbDir, options.databaseUrl, ["generate"]);

	return `Migration ${migrationName} validated on a copy and applied to the live database.`;
}

async function validateRuntimeSchemaChange(
	options: MigrateRuntimeSchemaOptions,
	name: string,
	beforeMigrations: string[],
): Promise<string> {
	const migrationName = cleanMigrationName(name);
	await assertRuntimeSchemaHasSystemModels(options.dbDir);

	const copyPath = join(options.dbDir, `.migrate-validate-${Date.now()}.sqlite`);
	await snapshotDatabase(options.databaseUrl, copyPath);

	try {
		prisma(options.dbDir, `file:${copyPath}`, ["migrate", "dev", "--name", migrationName]);
		await assertRuntimeSchemaHasSystemModels(options.dbDir);
		await assertCreatedMigrationsPreserveSystemTables(options.dbDir, beforeMigrations);
		return migrationName;
	} catch (error) {
		await removeCreatedMigrations(options.dbDir, beforeMigrations);
		throw error;
	} finally {
		await rm(copyPath, { force: true }).catch(() => {});
	}
}

function cleanMigrationName(name: string): string {
	const migrationName = name
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
	if (!migrationName) {
		throw new Error("Migration name must contain letters or numbers");
	}
	return migrationName;
}

async function assertRuntimeSchemaHasSystemModels(dbDir: string): Promise<void> {
	const schema = await readFile(join(dbDir, "schema.prisma"), "utf8");
	const missing = RHO_SYSTEM_MODELS.filter((model) => !modelPattern(model).test(schema));
	if (missing.length > 0) {
		throw new Error(
			`Runtime schema is missing rho system models: ${missing.join(", ")}. ` +
				"The rho_sys_* system models are rho-owned and must never be removed from schema.prisma.",
		);
	}
}

function modelPattern(model: string): RegExp {
	return new RegExp(`\\bmodel\\s+${escapeRegExp(model)}\\b`);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertCreatedMigrationsPreserveSystemTables(
	dbDir: string,
	beforeMigrations: string[],
): Promise<void> {
	const before = new Set(beforeMigrations);
	const created = (await migrationDirs(dbDir)).filter((migration) => !before.has(migration));
	const touchingSystemTables: string[] = [];

	for (const migration of created) {
		const sql = await readFile(join(dbDir, "migrations", migration, "migration.sql"), "utf8");
		if (/\brho_sys_/i.test(sql)) {
			touchingSystemTables.push(migration);
		}
	}

	if (touchingSystemTables.length > 0) {
		throw new Error(
			`Migration would touch rho system tables: ${touchingSystemTables.join(", ")}. ` +
				"The rho_sys_* tables are owned by Rho and cannot be changed by runtime schema edits.",
		);
	}
}

async function migrationDirs(dbDir: string): Promise<string[]> {
	try {
		const entries = await readdir(join(dbDir, "migrations"), { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
	} catch (error) {
		if (errorCode(error) === "ENOENT") {
			return [];
		}
		throw error;
	}
}

async function removeCreatedMigrations(dbDir: string, beforeMigrations: string[]): Promise<void> {
	const before = new Set(beforeMigrations);
	const created = (await migrationDirs(dbDir)).filter((migration) => !before.has(migration));

	await Promise.all(
		created.map((migration) => rm(join(dbDir, "migrations", migration), { recursive: true, force: true })),
	);
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

function errorCode(error: unknown): string | undefined {
	if (!error || typeof error !== "object" || !("code" in error)) {
		return undefined;
	}
	return typeof error.code === "string" ? error.code : undefined;
}
