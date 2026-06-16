import type { AnyRouter } from "@orpc/server";
import type {
	AppClient,
	AppExtension,
	AppRoute,
	RhoDb as CoreRhoDb,
	RhoExtensionContext as CoreRhoExtensionContext,
	RhoExtensionDefinition,
	RhoHostPlatform,
} from "@rho/core";

export type {
	AgentExtension,
	AppClient,
	AppExtension,
	AppRoute,
	CronContext,
	CronInput,
	CronKind,
	CronListScope,
	CronPurpose,
	CronRegistration,
	CronSchedule,
	CronStatus,
	CronSummary,
	RhoAgentExtensionSource,
	RhoAppApiBuilderContext,
	RhoAppApiContext,
	RhoExtensionDefinition,
	RhoHostPlatform,
} from "@rho/core";

export type { RhoAppInstance, RhoAppMount } from "./react.ts";

/**
 * Extension-owned models added to the runtime schema. App extensions augment
 * this interface from `@rho/apps-sdk` so `rho.db.<model>` is typed without
 * importing Rho's internal core package.
 */
// biome-ignore lint/suspicious/noEmptyInterface: merged by app extensions
export interface RhoRuntimeModels {}

/** The shared runtime database client, plus models declared by this extension. */
export type RhoDb = CoreRhoDb & RhoRuntimeModels;

export type RhoExtensionContext = Omit<CoreRhoExtensionContext, "db"> & {
	/** Shared runtime database client over the canonical Rho schema. */
	db: RhoDb;
};

/**
 * Loosely-typed Prisma delegate for a model an extension added to the
 * runtime schema. Declare it on the RhoRuntimeModels augmentation so
 * `rho.db.<model>` returns typed rows; argument shapes are not checked.
 */
export interface RhoModelDelegate<Row> {
	findMany(args?: unknown): Promise<Row[]>;
	findFirst(args?: unknown): Promise<Row | null>;
	findUnique(args: unknown): Promise<Row | null>;
	create(args: unknown): Promise<Row>;
	createMany(args: unknown): Promise<{ count: number }>;
	update(args: unknown): Promise<Row>;
	updateMany(args: unknown): Promise<{ count: number }>;
	upsert(args: unknown): Promise<Row>;
	delete(args: unknown): Promise<Row>;
	deleteMany(args?: unknown): Promise<{ count: number }>;
	count(args?: unknown): Promise<number>;
}

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
