import type { RhoExtensionContext } from "@rho/apps-sdk";
import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const starterPlan = [
	{ dayOffset: 0, name: "Push day", details: "Bench press, overhead press, triceps" },
	{ dayOffset: 2, name: "Leg day", details: "Squats, lunges, hamstrings" },
	{ dayOffset: 4, name: "Pull day", details: "Rows, pulldowns, biceps" },
];

export type WorkoutRouter = ReturnType<typeof createRouter>;

export function createRouter({ api, db }: RhoExtensionContext) {
	return {
		week: api
			.input(z.object({ startDate: dateSchema, endDate: dateSchema }))
			.handler(async ({ input }) => {
				await ensureStarterPlan(input.startDate, input.endDate);

				const exercises = await db.plannedExercise.findMany({
					where: { date: { gte: input.startDate, lte: input.endDate } },
					orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
				});

				return { exercises };
			}),
		day: api.input(z.object({ date: dateSchema })).handler(async ({ input }) => {
			const exercises = await db.plannedExercise.findMany({
				where: { date: input.date },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			});

			return { exercises };
		}),
		create: api
			.input(
				z.object({
					date: dateSchema,
					name: z.string().trim().min(1),
					details: z.string().trim().optional(),
				}),
			)
			.handler(async ({ input }) => {
				const existingCount = await db.plannedExercise.count({ where: { date: input.date } });
				const exercise = await db.plannedExercise.create({
					data: {
						date: input.date,
						name: input.name,
						details: input.details || null,
						sortOrder: existingCount,
					},
				});

				return { exercise };
			}),
	};

	async function ensureStarterPlan(startDate: string, endDate: string) {
		const existingCount = await db.plannedExercise.count({
			where: { date: { gte: startDate, lte: endDate } },
		});
		if (existingCount > 0) {
			return;
		}

		const weekStart = parseDate(startDate);
		await db.plannedExercise.createMany({
			data: starterPlan.map((exercise, index) => ({
				date: formatDate(addDays(weekStart, exercise.dayOffset)),
				name: exercise.name,
				details: exercise.details,
				sortOrder: index,
			})),
		});
	}
}

function parseDate(date: string): Date {
	return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
