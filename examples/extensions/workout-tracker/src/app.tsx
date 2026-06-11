import { rhoApp, useRhoApp } from "@rho/apps-sdk/react";
import { Day } from "./routes/day.tsx";
import { Home } from "./routes/index.tsx";

function WorkoutTrackerApp() {
	const rho = useRhoApp();
	const date = dayRouteDate(rho.app.routePath);

	if (rho.app.routePath === "/") {
		return <Home />;
	}
	if (date) {
		return <Day date={date} />;
	}
	return <NotFound />;
}

function dayRouteDate(routePath: string): string | undefined {
	if (routePath === "/day") {
		return formatDate(new Date());
	}

	const match = /^\/day\/(\d{4}-\d{2}-\d{2})$/.exec(routePath);
	return match?.[1];
}

function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function NotFound() {
	const rho = useRhoApp();
	return (
		<main>
			<h2 className="text-2xl font-semibold tracking-tight">Route not found</h2>
			<p className="mt-2 text-sm text-muted-foreground">{rho.app.routePath}</p>
		</main>
	);
}

export default rhoApp(WorkoutTrackerApp);
