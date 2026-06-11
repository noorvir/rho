import { createAppExtension, defineExtension } from "@rho/apps-sdk";
import { createRouter } from "./api.ts";

export default defineExtension(async (rho) => ({
	apps: [
		createAppExtension({
			slug: "workout-tracker",
			name: "Workout Tracker",
			client: {
				entry: "./app.tsx",
			},
			routes: [
				{ path: "/", label: "Week" },
				{ path: "/day", label: "Day" },
			],
			api: {
				router: createRouter(rho),
			},
		}),
	],
}));
