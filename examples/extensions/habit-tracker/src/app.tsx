import { rhoApp, useRhoApp } from "@rho/apps-sdk/react";
import { Today } from "./routes/index.tsx";

function HabitTrackerApp() {
	const rho = useRhoApp();

	if (rho.app.routePath === "/") {
		return <Today />;
	}
	return <main>Route not found: {rho.app.routePath}</main>;
}

export default rhoApp(HabitTrackerApp);
