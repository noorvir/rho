import { ORPCError, os } from "@orpc/server";
import { getTableData, getTables } from "@rho/core";
import { tc } from "@rho/lib";
import * as z from "zod";
import { requireAuth } from "./auth.ts";
import type { HttpContext } from "./types.ts";

const p = os.$context<HttpContext>();
const authenticated = p.use(async ({ context, next }) => {
	await requireAuth(context);
	return next();
});

export function dataRouter() {
	return {
		listTables: authenticated
			.route({
				method: "GET",
				path: "/tables",
			})
			.handler(async ({ context }) => {
				const res = await tc(getTables(context.databaseUrl));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to list tables",
					});
				}

				return { tables: res.data };
			}),

		table: authenticated
			.route({
				method: "GET",
				path: "/tables/{name}",
			})
			.input(
				z.object({
					name: z.string().min(1),
					limit: z.coerce.number().int().min(1).optional(),
					offset: z.coerce.number().int().min(0).optional(),
					orderBy: z.string().optional(),
					order: z.string().optional(),
				}),
			)
			.handler(async ({ input, context }) => {
				const res = await tc(
					getTableData(context.databaseUrl, input.name, {
						limit: input.limit,
						offset: input.offset,
						orderBy: input.orderBy,
						order: input.order,
					}),
				);
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to load table data",
					});
				}

				const table = res.data;
				if (!table) {
					throw new ORPCError("NOT_FOUND", { message: "Unknown table" });
				}

				return table;
			}),
	};
}
