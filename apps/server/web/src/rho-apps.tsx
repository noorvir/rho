import type { RhoAppContext, RhoHostPlatform } from "@rho/apps-sdk";
import { RhoAppProvider } from "@rho/apps-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { DataTableSurface } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { loadAppExtensions, type AppExtensionSummary } from "./api.ts";

interface RhoAppsProps {
	appSlug?: string;
	routePath?: string;
}

type AppComponent = () => ReactNode;

export function RhoApps({ appSlug, routePath = "/" }: RhoAppsProps) {
	const apps = useQuery({
		queryKey: ["app-extensions"],
		queryFn: loadAppExtensions,
	});

	return (
		<DataTableSurface className="flex-1">
			<header className="flex items-center justify-between px-3 py-2">
				<div>
					<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
						Apps
					</p>
					<h2 className="mt-1 text-sm font-semibold">App extensions</h2>
				</div>
				<Button className="h-7 px-2 text-xs" disabled variant="outline">
					Install app
				</Button>
			</header>

			<Separator />

			<div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-2">
				{apps.isPending ? <EmptyState title="Loading app extensions" /> : null}
				{apps.isError ? <EmptyState title="Failed to load app extensions" /> : null}
				{apps.isSuccess && apps.data.length === 0 ? (
					<EmptyState title="No app extensions loaded" />
				) : null}
				{apps.isSuccess && apps.data.length > 0 && !appSlug ? <AppList apps={apps.data} /> : null}
				{apps.isSuccess && appSlug ? (
					<AppRuntime appSlug={appSlug} apps={apps.data} routePath={routePath} />
				) : null}
			</div>
		</DataTableSurface>
	);
}

function AppRuntime({ apps, appSlug, routePath }: { apps: AppExtensionSummary[]; appSlug: string; routePath: string }) {
	const app = apps.find((candidate) => candidate.slug === appSlug);
	const appModule = useQuery({
		queryKey: ["app-client", appSlug, app?.clientModuleUrl],
		queryFn: () => loadApp(app?.clientModuleUrl),
		enabled: Boolean(app),
	});
	const context = useMemo(() => (app ? appContext(app, routePath) : undefined), [app, routePath]);

	if (!app) {
		return <EmptyState title="Unknown app extension" />;
	}
	if (appModule.isPending || !context) {
		return <EmptyState title="Loading app" />;
	}
	if (appModule.isError) {
		return <EmptyState title="Failed to load app" />;
	}

	const App = appModule.data;
	return (
		<div className="min-h-full bg-muted/30 p-3">
			<div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<Link className="hover:text-foreground" to="/apps">
					Apps
				</Link>
				<span>/</span>
				<span>{app.name}</span>
				<Badge variant="outline">{context.host.platform}</Badge>
			</div>
			<RhoAppProvider context={context}>
				<App />
			</RhoAppProvider>
		</div>
	);
}

async function loadApp(moduleUrl: string | undefined): Promise<AppComponent> {
	if (!moduleUrl) {
		throw new Error("Missing app module URL");
	}

	const module = await import(/* @vite-ignore */ moduleUrl);
	if (typeof module === "object" && module !== null && "default" in module) {
		const component = module.default;
		if (isAppComponent(component)) {
			return component;
		}
	}

	throw new Error("App module must default-export a component");
}

function isAppComponent(value: unknown): value is AppComponent {
	return typeof value === "function";
}

function appContext(app: AppExtensionSummary, routePath: string): RhoAppContext {
	const apiBasePath = app.apiBasePath ?? `/apps/${app.slug}/api`;
	const platform = hostPlatform();
	const apiHeaders = () => ({ "X-Rho-Platform": platform });
	return {
		app: {
			slug: app.slug,
			name: app.name,
			basePath: `/apps/${app.slug}`,
			apiBasePath,
			routePath,
		},
		host: {
			platform,
		},
		apiUrl(path) {
			const normalizedPath = path.startsWith("/") ? path : `/${path}`;
			return `${apiBasePath}${normalizedPath}`;
		},
		apiHeaders,
		apiFetch(path, init) {
			return fetch(this.apiUrl(path), {
				...init,
				headers: {
					...apiHeaders(),
					...init?.headers,
				},
			});
		},
	};
}

function hostPlatform(): RhoHostPlatform {
	const value = new URLSearchParams(window.location.search).get("rhoPlatform");
	return value === "mobile" || value === "desktop" ? value : "web";
}

function AppList({ apps }: { apps: AppExtensionSummary[] }) {
	return (
		<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
			{apps.map((app) => (
				<AppCard app={app} key={app.slug} />
			))}
		</div>
	);
}

function AppCard({ app }: { app: AppExtensionSummary }) {
	return (
		<article className="bg-background p-3 ring-1 ring-border/80">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold">{app.name}</h3>
					<p className="mt-1 font-mono text-xs text-muted-foreground">/apps/{app.slug}</p>
				</div>
				<Badge variant="outline">Loaded</Badge>
			</div>

			<div className="mt-3 space-y-2 text-xs">
				<div>
					<p className="font-medium text-muted-foreground">Routes</p>
					<div className="mt-1 flex flex-wrap gap-1">
						{app.routes.map((route) => (
							<Badge asChild key={route.path} variant="secondary">
								<Link to={appRouteHref(app.slug, route.path)}>{route.label ?? route.path}</Link>
							</Badge>
						))}
					</div>
				</div>

				{app.apiBasePath ? (
					<div>
						<p className="font-medium text-muted-foreground">API</p>
						<p className="mt-1 font-mono text-muted-foreground">{app.apiBasePath}</p>
					</div>
				) : null}
			</div>
		</article>
	);
}

function appRouteHref(slug: string, path: string): string {
	return path === "/" ? `/apps/${slug}` : `/apps/${slug}${path}`;
}

function EmptyState({ title }: { title: string }) {
	return (
		<div className="flex min-h-48 items-center justify-center p-6 text-center">
			<div className="max-w-sm">
				<p className="text-sm font-medium">{title}</p>
				<p className="mt-2 text-xs leading-5 text-muted-foreground">
					This is the web runtime surface where rho app extensions render under /apps.
				</p>
			</div>
		</div>
	);
}
