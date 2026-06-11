import type { RhoExtensionContext } from "@rho/apps-sdk";
import { z } from "zod";

export const readingStatus = z.enum(["want_to_read", "currently_reading", "finished"]);

export type ReadingStatus = z.infer<typeof readingStatus>;

export type ReadingListRouter = ReturnType<typeof createRouter>;

export function createRouter({ api, db }: RhoExtensionContext) {
	return {
		list: api.handler(async () => {
			const books = await db.book.findMany({ orderBy: { createdAt: "desc" } });
			return { books };
		}),
		get: api.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
			const book = await db.book.findUnique({ where: { id: input.id } });
			return { book };
		}),
		create: api
			.input(
				z.object({
					title: z.string().trim().min(1),
					author: z.string().trim().min(1),
				}),
			)
			.handler(async ({ input }) => {
				const book = await db.book.create({
					data: { title: input.title, author: input.author },
				});
				return { book };
			}),
		updateStatus: api
			.input(z.object({ id: z.number().int(), status: readingStatus }))
			.handler(async ({ input }) => {
				const book = await db.book.update({
					where: { id: input.id },
					data: { status: input.status },
				});
				return { book };
			}),
	};
}
