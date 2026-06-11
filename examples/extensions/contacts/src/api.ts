import type { RhoExtensionContext } from "@rho/apps-sdk";
import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || null);
const optionalEmail = z.email().or(z.literal("")).transform((value) => value || null);

export type ContactsRouter = ReturnType<typeof createRouter>;

export function createRouter({ api, db }: RhoExtensionContext) {
	return {
		list: api.handler(async () => {
			const contacts = await db.contact.findMany({ orderBy: { name: "asc" } });
			return { contacts };
		}),
		create: api
			.input(
				z.object({
					name: z.string().trim().min(1),
					email: optionalEmail,
					phone: optionalText,
					notes: optionalText,
				}),
			)
			.handler(async ({ input }) => {
				const contact = await db.contact.create({
					data: {
						name: input.name,
						email: input.email,
						phone: input.phone,
						notes: input.notes,
						relationship: "Friend",
						lastContactedAt: new Date(),
					},
				});

				return { contact };
			}),
	};
}
