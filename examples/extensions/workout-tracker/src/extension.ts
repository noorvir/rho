import { createAppExtension } from "@rho/apps-sdk";

export default createAppExtension({
	slug: "workout-tracker",
	name: "Workout Tracker",
	client: {
		entry: "./app.tsx",
	},
	routes: [
		{ path: "/", label: "Home" },
		{ path: "/workouts", label: "Workouts" },
	],
	api: {
		basePath: "/api",
		entry: "./api.ts",
	},
});
