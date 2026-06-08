import type { RhoCore } from "@rho/core";
import type { RhoAuth } from "../auth.ts";

export interface HttpContext {
	auth: RhoAuth;
	core: RhoCore;
	databaseUrl: string;
	requestUrl: string;
	reqHeaders?: Headers;
	resHeaders?: Headers;
}
