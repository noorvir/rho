import { useRhoApp } from "@rho/apps-sdk/react";
import { Home } from "./routes/index.tsx";
import { Workouts } from "./routes/workouts.tsx";

export default function WorkoutTrackerApp() {
	const rho = useRhoApp();

	switch (rho.app.routePath) {
		case "/":
			return <Home />;
		case "/workouts":
			return <Workouts />;
		default:
			return <NotFound />;
	}
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
