import { createAppExtension, defineExtension } from "@rho/apps-sdk";
import { createRouter } from "./api.ts";

export default defineExtension(async (rho) => ({
	apps: [
		createAppExtension({
			slug: "habit-tracker",
			name: "Habit Tracker",
			client: {
				entry: "./app.tsx",
			},
			routes: [{ path: "/", label: "Today" }],
			api: {
				router: createRouter(rho),
			},
		}),
	],
}));
