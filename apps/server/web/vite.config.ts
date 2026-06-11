import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = new URL(".", import.meta.url).pathname;

// Fixed-name entries re-exporting the shell's React/query/sdk instances.
// Server-built app bundles import these URLs so the page keeps a single
// instance of each (hooks and context break across duplicate copies).
const runtimeEntries = {
	"runtime-react": new URL("./src/runtime/react.js", import.meta.url).pathname,
	"runtime-jsx": new URL("./src/runtime/jsx-runtime.js", import.meta.url).pathname,
	"runtime-react-dom": new URL("./src/runtime/react-dom.js", import.meta.url).pathname,
	"runtime-react-query": new URL("./src/runtime/react-query.js", import.meta.url).pathname,
	"runtime-apps-sdk-react": new URL("./src/runtime/apps-sdk-react.js", import.meta.url).pathname,
};

export default defineConfig({
	root,
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": new URL("./src", import.meta.url).pathname,
		},
	},
	build: {
		rollupOptions: {
			// Vite defaults this to false for HTML builds, which would strip the
			// runtime entries' exports.
			preserveEntrySignatures: "exports-only",
			input: {
				main: new URL("./index.html", import.meta.url).pathname,
				...runtimeEntries,
			},
			output: {
				entryFileNames: (chunk) =>
					chunk.name in runtimeEntries ? "assets/[name].js" : "assets/[name]-[hash].js",
			},
		},
	},
});
