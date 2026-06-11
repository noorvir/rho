import type { RhoExtensionContext } from "@rho/apps-sdk";
import { z } from "zod";

export type TodoRouter = ReturnType<typeof createRouter>;

export function createRouter({ api, db }: RhoExtensionContext) {
	return {
		list: api.handler(async () => {
			const todos = await db.todo.findMany({ orderBy: { createdAt: "desc" } });
			return { todos };
		}),
		create: api
			.input(z.object({ title: z.string().trim().min(1) }))
			.handler(async ({ input }) => {
				const todo = await db.todo.create({ data: { title: input.title } });
				return { todo };
			}),
		toggle: api
			.input(z.object({ id: z.number().int(), completed: z.boolean() }))
			.handler(async ({ input }) => {
				const todo = await db.todo.update({
					where: { id: input.id },
					data: { completed: input.completed },
				});
				return { todo };
			}),
		remove: api
			.input(z.object({ id: z.number().int() }))
			.handler(async ({ input }) => {
				await db.todo.delete({ where: { id: input.id } });
				return { ok: true };
			}),
	};
}
