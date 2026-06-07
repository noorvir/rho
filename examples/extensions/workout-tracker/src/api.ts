import type { RhoAppApiHandler } from "@rho/apps-sdk";

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

export const fetch: RhoAppApiHandler = async (request, context) => {
	const url = new URL(request.url);
	const route = url.pathname.slice(context.app.apiBasePath.length) || "/";

	if (request.method === "GET" && route === "/summary") {
		return Response.json({ summary, platform: context.host.platform });
	}

	if (request.method === "GET" && route === "/workouts") {
		return Response.json({ workouts });
	}

	return Response.json({ error: "Not found" }, { status: 404 });
};
