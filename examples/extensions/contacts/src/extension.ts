import { createAppExtension, defineExtension } from "@rho/apps-sdk";
import { createRouter } from "./api.ts";

export default defineExtension(async (rho) => ({
	apps: [
		createAppExtension({
			slug: "contacts",
			name: "Contacts",
			client: {
				entry: "./app.tsx",
			},
			routes: [{ path: "/", label: "Contacts" }],
			api: {
				router: createRouter(rho),
			},
		}),
	],
}));
