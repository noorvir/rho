import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminShell } from "./routes/admin-shell.tsx";
import { Dashboard } from "./routes/dashboard.tsx";
import { DataPage } from "./routes/data.tsx";
import "./styles.css";

const rootRoute = createRootRoute({
	component: Root,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: Dashboard,
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

const routeTree = rootRoute.addChildren([indexRoute, dataRoute, dataTableRoute]);
const router = createRouter({ routeTree });
const queryClient = new QueryClient();

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function DataTableRoute() {
	const { tableName } = dataTableRoute.useParams();
	return <DataPage tableName={tableName} />;
}

function Root() {
	return <AdminShell />;
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
