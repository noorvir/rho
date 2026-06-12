import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Creates or repairs the rho home directory: agent/state dirs, the runtime
 * database (seed schema, migrations applied, client generated), and the
 * extensions workspace. Idempotent — run it on every server boot or after an
 * upgrade to apply new template migrations.
 */
export async function runInitCommand(): Promise<void> {
	const home = rhoHome();
	const dbDir = join(home, "db");
	const extensionsDir = join(home, "extensions");

	for (const dir of [join(home, "agent"), join(home, "state"), dbDir, extensionsDir]) {
		await mkdir(dir, { recursive: true });
	}

	// Seed db/ from core's template without overwriting runtime-owned files.
	// The schema belongs to the runtime after init; template migrations are
	// additive and copied so `migrate deploy` can apply new system migrations
	// after upgrades.
	const template = dirname(require.resolve("@rho/core/package.json"));
	const templateDb = join(template, "db-template");
	if (!existsSync(join(dbDir, "schema.prisma"))) {
		await cp(join(templateDb, "schema.prisma"), join(dbDir, "schema.prisma"));
	}
	if (!existsSync(join(dbDir, "prisma.config.ts"))) {
		await cp(join(templateDb, "prisma.config.ts"), join(dbDir, "prisma.config.ts"));
	}
	await cp(join(templateDb, "migrations"), join(dbDir, "migrations"), {
		recursive: true,
		force: false,
	});

	const databaseUrl = `file:${join(dbDir, "rho.sqlite")}`;
	prisma(dbDir, databaseUrl, ["migrate", "deploy"]);
	prisma(dbDir, databaseUrl, ["generate"]);

	if (!existsSync(join(extensionsDir, "package.json"))) {
		await writeFile(
			join(extensionsDir, "package.json"),
			`${JSON.stringify(extensionsPackage(), null, "\t")}\n`,
		);
	}
	const install = spawnSync("bun", ["install"], { cwd: extensionsDir, stdio: "inherit" });
	if (install.status !== 0) {
		throw new Error("bun install failed in the extensions workspace");
	}

	console.log(`rho home ready at ${home}`);
}

export function rhoHome(): string {
	const fromEnv = process.env.RHO_HOME?.trim();
	return resolve(fromEnv || join(homedir(), ".rho"));
}

function prisma(dbDir: string, databaseUrl: string, args: string[]): void {
	const corePackage = require.resolve("@rho/core/package.json");
	const prismaPackage = createRequire(corePackage).resolve("prisma/package.json");
	const prismaBin = join(dirname(prismaPackage), "build", "index.js");

	const result = spawnSync(
		process.execPath,
		[prismaBin, ...args, "--config", join(dbDir, "prisma.config.ts")],
		{
			cwd: dbDir,
			env: { ...process.env, DATABASE_URL: databaseUrl },
			stdio: "inherit",
		},
	);
	if (result.status !== 0) {
		throw new Error(`prisma ${args.join(" ")} failed`);
	}
}

// The extensions workspace shares one dependency set across all extensions.
// @rho/* packages link to the installed runtime by absolute path — both as
// direct dependencies and as overrides so their internal 0.0.0 references
// resolve locally instead of against the npm registry.
function extensionsPackage(): Record<string, unknown> {
	const links = rhoPackageLinks();

	return {
		name: "rho-extensions",
		private: true,
		type: "module",
		workspaces: ["*"],
		dependencies: {
			"@orpc/client": "^1.12.0",
			"@orpc/react-query": "^1.12.0",
			"@orpc/server": "^1.12.0",
			"@prisma/client": "7.8.0",
			"@rho/apps-sdk": links["@rho/apps-sdk"],
			"@rho/ui": links["@rho/ui"],
			"@tanstack/react-query": "^5.90.12",
			prisma: "7.8.0",
			react: "^19.2.1",
			"react-dom": "^19.2.1",
			zod: "4.4.3",
		},
		devDependencies: {
			"@types/react": "^19.2.7",
			"@types/react-dom": "^19.2.3",
			typescript: "^5.9.2",
		},
		overrides: links,
	};
}

function rhoPackageLinks(): Record<string, string> {
	const links: Record<string, string> = {};
	for (const name of ["@rho/apps-sdk", "@rho/ui", "@rho/core", "@rho/ai", "@rho/lib"]) {
		links[name] = `file:${dirname(require.resolve(`${name}/package.json`))}`;
	}

	const coreRequire = createRequire(require.resolve("@rho/core/package.json"));
	links["@rho/channels"] = `file:${dirname(coreRequire.resolve("@rho/channels/package.json"))}`;
	return links;
}
