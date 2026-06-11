/**
 * Compiles extension app client modules (TSX source) into browser ESM for the
 * production server, where no vite dev server exists. Shared libraries stay
 * external and their import specifiers are rewritten to the shell's fixed
 * runtime module URLs, so the page keeps a single React/query/sdk instance;
 * everything else is bundled in.
 */
const sharedRuntimeModules: Record<string, string> = {
	react: "/assets/runtime-react.js",
	"react/jsx-runtime": "/assets/runtime-jsx.js",
	"react/jsx-dev-runtime": "/assets/runtime-jsx.js",
	"react-dom": "/assets/runtime-react-dom.js",
	"@tanstack/react-query": "/assets/runtime-react-query.js",
	"@rho/apps-sdk/react": "/assets/runtime-apps-sdk-react.js",
};

export async function bundleAppClient(entry: string): Promise<string> {
	const result = await Bun.build({
		entrypoints: [entry],
		target: "browser",
		format: "esm",
		minify: true,
		sourcemap: "none",
		external: Object.keys(sharedRuntimeModules),
		define: { "process.env.NODE_ENV": JSON.stringify("production") },
	});

	if (!result.success || result.outputs.length === 0) {
		const messages = result.logs.map((log) => log.message).join("\n");
		throw new Error(`Failed to bundle app client ${entry}:\n${messages}`);
	}

	const code = await result.outputs[0].text();
	return rewriteSharedImports(code);
}

/**
 * Rewrites external import specifiers to runtime module URLs. The bundle is
 * esbuild-shaped output, where external imports appear only as
 * `from"<specifier>"`, `import"<specifier>"`, or `import("<specifier>")`.
 */
function rewriteSharedImports(code: string): string {
	let rewritten = code;
	for (const [specifier, url] of Object.entries(sharedRuntimeModules)) {
		for (const keyword of ["from", "import"]) {
			rewritten = rewritten
				.replaceAll(`${keyword}"${specifier}"`, `${keyword}"${url}"`)
				.replaceAll(`${keyword} "${specifier}"`, `${keyword} "${url}"`)
				.replaceAll(`${keyword}("${specifier}")`, `${keyword}("${url}")`);
		}
	}
	return rewritten;
}
