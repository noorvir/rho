import { createAppExtension, defineExtension } from "@rho/apps-sdk";
import { createRouter } from "./api.ts";

export default defineExtension(async (rho) => ({
	apps: [
		createAppExtension({
			slug: "reading-list",
			name: "Reading List",
			client: {
				entry: "./app.tsx",
			},
			routes: [{ path: "/", label: "Books" }],
			api: {
				router: createRouter(rho),
			},
		}),
	],
}));
