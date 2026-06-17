import type { RhoCore } from "@rho/core";
import type { RhoAuth } from "../auth.ts";
import type { RhoStore } from "../store.ts";

/** How app client modules are delivered: vite dev URLs or server-built bundles. */
export type AppModuleMode = "vite" | "bundle";

export interface HttpContext {
	auth: RhoAuth;
	core: RhoCore;
	store: RhoStore;
	databaseUrl: string;
	/** Absolute agent config directory; owns runtime-selectable model settings. */
	agentDir: string;
	appModules: AppModuleMode;
	requestUrl: string;
	reqHeaders?: Headers;
	resHeaders?: Headers;
}
