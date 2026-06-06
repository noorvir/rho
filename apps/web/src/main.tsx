import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
	useRouterState,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminShell } from "./routes/admin-shell.tsx";
import { Dashboard } from "./routes/dashboard.tsx";
import { TablePage } from "./routes/table.tsx";
import "./styles.css";

const rootRoute = createRootRoute({
	component: Root,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: Dashboard,
});

const tableRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/table",
	component: TablePage,
});

const routeTree = rootRoute.addChildren([indexRoute, tableRoute]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function Root() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });

	if (pathname === "/table") {
		return <Outlet />;
	}

	return <AdminShell />;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Missing root element");
}

createRoot(rootElement).render(
	<StrictMode>
		<TooltipProvider>
			<RouterProvider router={router} />
		</TooltipProvider>
	</StrictMode>,
);
