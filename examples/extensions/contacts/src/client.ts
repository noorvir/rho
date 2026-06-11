import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import type { RouterClient } from "@orpc/server";
import type { RhoAppContext } from "@rho/apps-sdk";
import { useRhoApp } from "@rho/apps-sdk/react";
import { useMemo } from "react";
import type { ContactsRouter } from "./api.ts";

export type ApiClient = RouterClient<ContactsRouter>;

export function createOrpcClient(rho: RhoAppContext): ApiClient {
	const link = new RPCLink({
		url: new URL(rho.app.apiBasePath, window.location.origin).toString(),
		headers: () => rho.apiHeaders(),
	});

	return createORPCClient<ApiClient>(link);
}

export function useApi() {
	const rho = useRhoApp();
	return useMemo(() => createORPCReactQueryUtils(createOrpcClient(rho)), [rho]);
}
