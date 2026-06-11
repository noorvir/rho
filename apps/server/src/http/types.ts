import type { RhoCore } from "@rho/core";
import type { RhoAuth } from "../auth.ts";

/** How app client modules are delivered: vite dev URLs or server-built bundles. */
export type AppModuleMode = "vite" | "bundle";

export interface HttpContext {
	auth: RhoAuth;
	core: RhoCore;
	databaseUrl: string;
	appModules: AppModuleMode;
	requestUrl: string;
	reqHeaders?: Headers;
	resHeaders?: Headers;
}
