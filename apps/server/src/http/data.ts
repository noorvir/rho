import { implement, ORPCError } from "@orpc/server";
import { getTableData, getTables } from "@rho/core";
import { tc } from "@rho/lib";
import { requireAuth } from "./auth.ts";
import { httpContract } from "./contract.ts";
import type { HttpContext } from "./types.ts";

const p = implement(httpContract).$context<HttpContext>();

export function dataRouter() {
	return {
		listTables: p.data.listTables.handler(async ({ context }) => {
				await requireAuth(context);
				const res = await tc(getTables(context.databaseUrl));
				if (res.error) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to list tables",
					});
				}

				return { tables: res.data };
			}),

		table: p.data.table.handler(async ({ input, context }) => {
				await requireAuth(context);
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
