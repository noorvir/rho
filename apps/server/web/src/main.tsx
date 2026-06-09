import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, RouterProvider, useLocation } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoginPage, ProtectedShell, SetupPage } from "./auth.tsx";
import { RhoApps } from "./rho-apps.tsx";
import { AppsPage } from "./routes/apps.tsx";
import { Dashboard } from "./routes/dashboard.tsx";
import { DataPage } from "./routes/data.tsx";
import { SettingsPage } from "./routes/settings.tsx";
import "./styles.css";

const rootRoute = createRootRoute({
	component: Root,
});

const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
});

const setupRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/setup",
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: Dashboard,
});

const appsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/apps",
	component: AppsPage,
});

const appHomeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/apps/$appSlug",
	component: AppHomeRoute,
});

const appPathRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/apps/$appSlug/$",
	component: AppPathRoute,
});

const dataRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/data",
	component: () => <DataPage />,
});

const dataTableRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/data/$tableName",
	component: DataTableRoute,
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
	loginRoute,
	setupRoute,
	indexRoute,
	appsRoute,
	appHomeRoute,
	appPathRoute,
	dataRoute,
	dataTableRoute,
	settingsRoute,
]);
const router = createRouter({ routeTree });
const queryClient = new QueryClient();

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function AppHomeRoute() {
	const { appSlug } = appHomeRoute.useParams();
	return <RhoApps appSlug={appSlug} />;
}

function AppPathRoute() {
	const { _splat, appSlug } = appPathRoute.useParams();
	return <RhoApps appSlug={appSlug} routePath={`/${_splat}`} />;
}

function DataTableRoute() {
	const { tableName } = dataTableRoute.useParams();
	return <DataPage tableName={tableName} />;
}

function Root() {
	const location = useLocation();

	if (location.pathname === "/login") {
		return <LoginPage />;
	}
	if (location.pathname === "/setup") {
		return <SetupPage />;
	}

	return <ProtectedShell />;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Missing root element");
}

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<RouterProvider router={router} />
			</TooltipProvider>
		</QueryClientProvider>
	</StrictMode>,
);
