import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { loadRhoContext, RHO_CONTEXT_BUDGET_CHARS } from "./rho-context.ts";

const docsDir = fileURLToPath(new URL("../../../docs/", import.meta.url));

test("rho_context bundles the core docs under budget", () => {
	const bundle = loadRhoContext(docsDir);

	expect(bundle).toContain("# Database");
	expect(bundle).toContain("# Channels");
	expect(bundle).toContain("# Server");
	expect(bundle.length).toBeLessThanOrEqual(RHO_CONTEXT_BUDGET_CHARS);
});
