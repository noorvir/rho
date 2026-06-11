/**
 * Compiles an extension app client module (TSX source) into one
 * self-contained browser ESM bundle. The app carries its own React, query
 * client, and sdk wrapper; nothing is shared with the shell besides the
 * mount-contract call and CSS variables, so no import linking is needed.
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
