import type { AnyRouter } from "@orpc/server";
import type {
	AppClient,
	AppExtension,
	AppRoute,
	RhoExtensionContext,
	RhoExtensionDefinition,
	RhoHostPlatform,
} from "@rho/core";

export type {
	AgentExtension,
	AppClient,
	AppExtension,
	AppRoute,
	RhoAgentExtensionSource,
	RhoAppApiBuilderContext,
	RhoAppApiContext,
	RhoExtensionContext,
	RhoExtensionDefinition,
	RhoHostPlatform,
} from "@rho/core";

export type { RhoAppInstance, RhoAppMount } from "./react.ts";

export interface RhoAppContext {
	app: {
		slug: string;
		name: string;
		basePath: string;
		apiBasePath: string;
		routePath: string;
	};
	host: {
		platform: RhoHostPlatform;
	};
	apiUrl(path: string): string;
	apiHeaders(): Record<string, string>;
	apiFetch(path: string, init?: RequestInit): Promise<Response>;
	/** Navigates to another route inside this app without a page reload. */
	navigate(routePath: string): void;
}

export interface AppExtensionInput {
	slug: string;
	name: string;
	client: AppClient;
	routes: AppRoute[];
	api?: {
		basePath?: string;
		router: AnyRouter;
	};
}

export function defineExtension<T extends (rho: RhoExtensionContext) => Promise<RhoExtensionDefinition>>(
	define: T,
): T {
	return define;
}

export function createAppExtension(extension: AppExtensionInput): AppExtension {
	const slug = cleanSlug(extension.slug);
	const routes = extension.routes.map(cleanRoute);

	let api: { basePath: string; router: AnyRouter } | undefined;

	if (extension.api) {
		const basePath = cleanPath(extension.api.basePath ?? "/api", "api.basePath");
		const router = extension.api.router;
		api = { basePath, router };
	}

	ensureUniqueRoutes(routes);

	return {
		type: "app",
		id: slug,
		slug,
		name: nonEmpty(extension.name, "name"),
		client: {
			entry: nonEmpty(extension.client.entry, "client.entry"),
		},
		routes,
		api,
	};
}

function cleanSlug(value: string): string {
	const slug = nonEmpty(value, "slug");
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		throw new Error("App extension slug must be lowercase kebab-case");
	}
	return slug;
}

function cleanRoute(route: AppRoute): AppRoute {
	return {
		path: cleanPath(route.path, "route.path"),
		label: route.label ? nonEmpty(route.label, "route.label") : undefined,
	};
}

function cleanPath(value: string, field: string): string {
	const path = nonEmpty(value, field);
	return path.startsWith("/") ? path : `/${path}`;
}

function nonEmpty(value: string, field: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`App extension ${field} is required`);
	}
	return trimmed;
}

function ensureUniqueRoutes(routes: AppRoute[]): void {
	const seen = new Set<string>();
	for (const route of routes) {
		if (seen.has(route.path)) {
			throw new Error(`Duplicate app extension route: ${route.path}`);
		}
		seen.add(route.path);
	}
}
