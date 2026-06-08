import type { RhoAppApiBuilderContext } from "@rho/apps-sdk";

const workouts = [
	{ id: "push", name: "Push Day", minutes: 45, focus: "Chest, shoulders, triceps" },
	{ id: "pull", name: "Pull Day", minutes: 50, focus: "Back and biceps" },
	{ id: "legs", name: "Leg Day", minutes: 55, focus: "Quads, hamstrings, glutes" },
];

const summary = {
	week: "Current week",
	completed: 3,
	planned: 4,
};

export type WorkoutRouter = ReturnType<typeof createRouter>;

export function createRouter({ api }: RhoAppApiBuilderContext) {
	return {
		summary: api.handler(({ context }) => ({ summary, platform: context.host.platform })),
		workouts: api.handler(() => ({ workouts })),
	};
}
