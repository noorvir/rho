import { rhoApp, useRhoApp } from "@rho/apps-sdk/react";
import { Contacts } from "./routes/index.tsx";

function ContactsApp() {
	const rho = useRhoApp();

	if (rho.app.routePath === "/") {
		return <Contacts />;
	}
	return <main>Route not found: {rho.app.routePath}</main>;
}

export default rhoApp(ContactsApp);
