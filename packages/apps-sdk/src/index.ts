import type { AppExtension, AppRoute } from "@rho/core";

export type { AppApi, AppClient, AppExtension, AppRoute } from "@rho/core";

export type RhoHostPlatform = "web" | "mobile" | "desktop";

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
	apiFetch(path: string, init?: RequestInit): Promise<Response>;
}

export interface RhoAppApiContext {
	app: {
		slug: string;
		name: string;
		basePath: string;
		apiBasePath: string;
	};
	host: {
		platform: RhoHostPlatform;
	};
}

export type RhoAppApiHandler = (request: Request, context: RhoAppApiContext) => Response | Promise<Response>;

export type AppExtensionInput = Omit<AppExtension, "type" | "id">;

export function createAppExtension(extension: AppExtensionInput): AppExtension {
	const slug = cleanSlug(extension.slug);
	const routes = extension.routes.map(cleanRoute);
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
		api: extension.api
			? {
					basePath: cleanPath(extension.api.basePath, "api.basePath"),
					entry: nonEmpty(extension.api.entry, "api.entry"),
				}
			: undefined,
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
