import type { RhoAppContext, RhoAppInstance, RhoAppMount, RhoHostPlatform } from "@rho/apps-sdk";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { DataTableSurface } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { orpc, type AppExtensionSummary } from "./api.ts";

declare global {
	interface Window {
		/** Client-side navigation hook the native shell calls to switch apps
		 * without reloading the document. */
		__rhoNavigate?: (path: string) => void;
		webkit?: { messageHandlers?: { rho?: { postMessage: (message: unknown) => void } } };
	}
}

interface RhoAppsProps {
	appSlug?: string;
	routePath?: string;
}

export function RhoApps({ appSlug, routePath = "/" }: RhoAppsProps) {
	const apps = useQuery(orpc.apps.list.queryOptions());

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
				{apps.isSuccess && apps.data.apps.length === 0 ? (
					<EmptyState title="No app extensions loaded" />
				) : null}
				{apps.isSuccess && apps.data.apps.length > 0 && !appSlug ? <AppList apps={apps.data.apps} /> : null}
				{apps.isSuccess && appSlug ? (
					<AppRuntime appSlug={appSlug} apps={apps.data.apps} routePath={routePath} />
				) : null}
			</div>
		</DataTableSurface>
	);
}

/**
 * Bare app surface for mobile/desktop WebViews: no admin shell, no
 * navigation chrome, platform reported as the embedding host.
 */
export function RhoEmbeddedApp({ appSlug, routePath = "/" }: { appSlug: string; routePath?: string }) {
	const apps = useQuery(orpc.apps.list.queryOptions());
	const navigate = useNavigate();

	// Native shell bridge: lets the app shell switch apps/routes client-side
	// (no document reload). Native calls window.__rhoNavigate with a full path.
	useEffect(() => {
		window.__rhoNavigate = (path: string) => {
			const match = /^\/embed\/apps\/([^/]+)(?:\/(.*))?$/.exec(path);
			if (!match) {
				return;
			}
			void navigate({
				to: "/embed/apps/$appSlug/$",
				params: { appSlug: match[1], _splat: match[2] ?? "" },
			});
		};
		window.webkit?.messageHandlers?.rho?.postMessage({ type: "ready" });
		return () => {
			delete window.__rhoNavigate;
		};
	}, [navigate]);

	// Warm every app's bundle + stylesheet in the background after the first app
	// loads, so switching to any app is instant (its module is already imported
	// and its CSS is in the HTTP cache).
	const appList = apps.data?.apps;
	useEffect(() => {
		if (!appList) {
			return;
		}
		let cancelled = false;
		const timer = setTimeout(async () => {
			for (const app of appList) {
				if (cancelled) {
					break;
				}
				try {
					await import(/* @vite-ignore */ app.clientModuleUrl);
					if (app.clientStylesUrl) {
						await fetch(app.clientStylesUrl);
					}
				} catch {
					// Prefetch is best-effort; ignore failures.
				}
			}
		}, 800);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [appList]);

	if (apps.isPending) {
		return <EmbedMessage text="Loading…" />;
	}
	if (apps.isError || !apps.data) {
		return <EmbedMessage text="Couldn't load this app. Open Rho and try again." />;
	}

	return (
		<div className="min-h-screen bg-background">
			<AppRuntime apps={apps.data.apps} appSlug={appSlug} embedded routePath={routePath} />
		</div>
	);
}

function EmbedMessage({ text }: { text: string }) {
	return (
		<div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
			{text}
		</div>
	);
}

function AppRuntime({
	apps,
	appSlug,
	routePath,
	embedded = false,
}: {
	apps: AppExtensionSummary[];
	appSlug: string;
	routePath: string;
	embedded?: boolean;
}) {
	const app = apps.find((candidate) => candidate.slug === appSlug);
	const appModule = useQuery({
		queryKey: ["app-client", appSlug, app?.clientModuleUrl],
		queryFn: () => loadApp(app?.clientModuleUrl),
		enabled: Boolean(app),
	});
	const platform = embedded ? embeddedPlatform() : hostPlatform();
	const routerNavigate = useNavigate();
	const context = useMemo(() => {
		if (!app) {
			return undefined;
		}

		const navigate = (nextRoutePath: string) => {
			const splat = nextRoutePath.replace(/^\//, "");
			if (embedded) {
				void routerNavigate({ to: "/embed/apps/$appSlug/$", params: { appSlug: app.slug, _splat: splat } });
				return;
			}
			void routerNavigate({ to: "/apps/$appSlug/$", params: { appSlug: app.slug, _splat: splat } });
		};

		return appContext(app, routePath, platform, embedded, navigate);
	}, [app, routePath, platform, embedded, routerNavigate]);

	if (!app) {
		return <EmptyState title="Unknown app extension" />;
	}
	if (appModule.isPending || !context) {
		return <EmptyState title="Loading app" />;
	}
	if (appModule.isError) {
		return <EmptyState title="Failed to load app" />;
	}

	if (embedded) {
		return (
			<div className="fixed inset-0 overflow-y-auto overscroll-contain bg-background">
				<AppStyles app={app} />
				<MountedApp className="min-h-full w-full" context={context} mount={appModule.data} />
			</div>
		);
	}

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
			<AppStyles app={app} />
			<MountedApp context={context} mount={appModule.data} />
		</div>
	);
}

/** Loads the app's generated stylesheet; React hoists and dedupes it in <head>. */
function AppStyles({ app }: { app: AppExtensionSummary }) {
	if (!app.clientStylesUrl) {
		return null;
	}
	return <link href={app.clientStylesUrl} precedence="default" rel="stylesheet" />;
}

/**
 * Hands a container element to the app bundle's mount function. The app
 * mounts once per bundle; later context changes (route navigation) flow
 * through the instance's update channel without remounting.
 */
function MountedApp({ mount, context, className }: { mount: RhoAppMount; context: RhoAppContext; className?: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const instanceRef = useRef<RhoAppInstance>(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	useEffect(() => {
		const element = containerRef.current;
		if (!element) {
			return;
		}
		const instance = mount(element, contextRef.current);
		instanceRef.current = instance;
		return () => {
			instanceRef.current = null;
			instance.unmount();
		};
	}, [mount]);

	useEffect(() => {
		instanceRef.current?.update(context);
	}, [context]);

	return <div className={className} ref={containerRef} />;
}

async function loadApp(moduleUrl: string | undefined): Promise<RhoAppMount> {
	if (!moduleUrl) {
		throw new Error("Missing app module URL");
	}

	const module = await import(/* @vite-ignore */ moduleUrl);
	if (typeof module === "object" && module !== null && "default" in module) {
		const mount = module.default;
		if (isAppMount(mount)) {
			return mount;
		}
	}

	throw new Error("App module must default-export a rho app mount function");
}

function isAppMount(value: unknown): value is RhoAppMount {
	return typeof value === "function";
}

function appContext(
	app: AppExtensionSummary,
	routePath: string,
	platform: RhoHostPlatform,
	embedded: boolean,
	navigate: (routePath: string) => void,
): RhoAppContext {
	const apiBasePath = app.apiBasePath ?? `/apps/${app.slug}/api`;
	const basePath = embedded ? `/embed/apps/${app.slug}` : `/apps/${app.slug}`;
	const apiHeaders = () => ({ "X-Rho-Platform": platform });
	return {
		app: {
			slug: app.slug,
			name: app.name,
			basePath,
			apiBasePath,
			routePath,
		},
		host: {
			platform,
		},
		navigate,
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

function embeddedPlatform(): RhoHostPlatform {
	const value = new URLSearchParams(window.location.search).get("rhoPlatform");
	return value === "desktop" ? value : "mobile";
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
