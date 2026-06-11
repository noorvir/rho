import { createAppExtension, defineExtension } from "@rho/apps-sdk";
import { createRouter } from "./api.ts";

export default defineExtension(async (rho) => ({
	apps: [
		createAppExtension({
			slug: "todo-list",
			name: "Todo List",
			client: {
				entry: "./app.tsx",
			},
			routes: [{ path: "/", label: "Todos" }],
			api: {
				router: createRouter(rho),
			},
		}),
	],
}));
