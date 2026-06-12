import type { RhoExtensionContext } from "@rho/apps-sdk";
import { z } from "zod";

export type HabitRouter = ReturnType<typeof createRouter>;

/** Local calendar day as YYYY-MM-DD; the runtime shares the user's timezone. */
function todayKey() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function createRouter({ api, db }: RhoExtensionContext) {
	return {
		today: api.handler(async () => {
			const date = todayKey();
			const habits = await db.habit.findMany({
				orderBy: { createdAt: "asc" },
				include: { completions: { where: { date } } },
			});

			return {
				date,
				habits: habits.map((habit) => ({
					id: habit.id,
					name: habit.name,
					done: habit.completions.length > 0,
				})),
			};
		}),
		create: api
			.input(z.object({ name: z.string().trim().min(1) }))
			.handler(async ({ input }) => {
				const habit = await db.habit.create({ data: { name: input.name } });
				return { habit };
			}),
		remove: api
			.input(z.object({ id: z.number().int() }))
			.handler(async ({ input }) => {
				await db.habit.delete({ where: { id: input.id } });
				return { ok: true };
			}),
		setDone: api
			.input(z.object({ id: z.number().int(), done: z.boolean() }))
			.handler(async ({ input }) => {
				const date = todayKey();

				if (input.done) {
					await db.habitCompletion.upsert({
						where: { habitId_date: { habitId: input.id, date } },
						create: { habitId: input.id, date },
						update: {},
					});
				} else {
					await db.habitCompletion.deleteMany({
						where: { habitId: input.id, date },
					});
				}

				return { ok: true };
			}),
	};
}
