import { rhoApp, useRhoApp } from "@rho/apps-sdk/react";
import { Todos } from "./routes/index.tsx";

function TodoListApp() {
	const rho = useRhoApp();

	if (rho.app.routePath === "/") {
		return <Todos />;
	}
	return <main>Route not found: {rho.app.routePath}</main>;
}

export default rhoApp(TodoListApp);
