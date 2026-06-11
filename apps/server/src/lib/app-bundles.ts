import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Compiles an extension app client module (TSX source) into one
 * self-contained browser ESM bundle. The app carries its own React, query
 * client, and sdk wrapper; nothing is shared with the shell besides the
 * mount-contract call and CSS variables, so no import linking is needed.
 *
 * Bun.build is used in its plainest mode (one entry, no plugins, no
 * externals). If it ever proves unreliable, esbuild is a near drop-in, and
 * programmatic `vite build` is the heavyweight fallback — slower but the
 * most battle-tested.
 */
export async function bundleAppClient(entry: string): Promise<string> {
	const result = await Bun.build({
		entrypoints: [entry],
		target: "browser",
		format: "esm",
		minify: true,
		sourcemap: "none",
		define: { "process.env.NODE_ENV": JSON.stringify("production") },
	});

	if (!result.success || result.outputs.length === 0) {
		const messages = result.logs.map((log) => log.message).join("\n");
		throw new Error(`Failed to bundle app client ${entry}:\n${messages}`);
	}

	return result.outputs[0].text();
}

// Resolves tailwindcss/shadcn imports in generated style inputs against the
// server package, which owns those dependencies.
const serverPackageDir = fileURLToPath(new URL("../..", import.meta.url));

// Apps composed from @rho/ui use tailwind classes inside the library's
// compiled output, so its dist must be scanned alongside the app's source.
function uiPackageSources(appSourceDir: string): string[] {
	try {
		const uiPackage = Bun.resolveSync("@rho/ui/package.json", appSourceDir);
		return [join(dirname(uiPackage), "dist")];
	} catch {
		return [];
	}
}

/**
 * Generates the app's stylesheet: tailwind utilities for the classes used in
 * the app's source plus the rho theme tokens. Preflight is deliberately
 * excluded — the shell already applies the base reset document-wide — so app
 * CSS layers on top without clashing, and theme values resolve at runtime
 * from the shell's CSS variables.
 */
export async function bundleAppStyles(entry: string): Promise<string> {
	const sourceDir = dirname(entry);
	const sources = [sourceDir, ...uiPackageSources(sourceDir)];
	const input = [
		// Declare the full canonical layer order first: this sheet can load
		// before the shell's, and whichever sheet declares layers first fixes
		// their priority — without base/components here, the shell's preflight
		// would land after utilities and reset every spacing class.
		`@layer theme, base, components, utilities;`,
		`@import "tailwindcss/theme.css" layer(theme);`,
		`@import "tailwindcss/utilities.css" layer(utilities);`,
		`@import "shadcn/tailwind.css";`,
		`@import "tw-animate-css";`,
		`@custom-variant dark (&:is(.dark *));`,
		...sources.map((dir) => `@source "${dir}";`),
	].join("\n");

	// The input file lives inside the server package so the CSS imports
	// resolve against its node_modules; the tailwind CLI resolves imports
	// relative to the input file, not the working directory.
	const workDir = join(serverPackageDir, ".app-css", crypto.randomUUID());
	const inputPath = join(workDir, "input.css");
	const outputPath = join(workDir, "output.css");
	// The CLI package exports only its package.json; resolve the bin from there.
	const cliPackage = Bun.resolveSync("@tailwindcss/cli/package.json", serverPackageDir);
	const cli = join(dirname(cliPackage), "dist", "index.mjs");

	try {
		await mkdir(workDir, { recursive: true });
		await writeFile(inputPath, input);

		const build = Bun.spawn(["bun", cli, "--input", inputPath, "--output", outputPath, "--minify"], {
			cwd: serverPackageDir,
			stdout: "ignore",
			stderr: "pipe",
		});
		const exitCode = await build.exited;
		if (exitCode !== 0) {
			const stderr = await new Response(build.stderr).text();
			throw new Error(`Failed to build app styles for ${entry}:\n${stderr}`);
		}

		return await readFile(outputPath, "utf8");
	} finally {
		await rm(workDir, { recursive: true, force: true }).catch(() => {});
	}
}
