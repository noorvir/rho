export type { AppClient, AppExtension, AppRoute } from "./apps/index.ts";
export { createRhoCore, type RhoCore, type RhoCoreOptions } from "./core.ts";
export {
	getTableData,
	getTables,
	type TableColumnInfo,
	type TableData,
	type TableOptions,
	type TableRow,
	type TableSummary,
} from "./db.ts";
export type {
	AgentExtension,
	RhoAgentExtensionSource,
	RhoAppApiBuilderContext,
	RhoAppApiContext,
	RhoExtensionContext,
	RhoExtensionDefinition,
	RhoHostPlatform,
} from "./extensions/index.ts";
export type { rho_sys_Task as Task } from "./generated/prisma/client.ts";
export { createRhoPrisma, type RhoPrisma } from "./prisma.ts";

import type { RhoPrisma as RhoPrismaClient } from "./prisma.ts";

/**
 * Augmentation hook for models that extensions add to the runtime schema.
 * Declared here so `declare module "@rho/core"` in an extension merges into
 * it and `rho.db.<model>` is typed without the model living in core's schema.
 */
// biome-ignore lint/suspicious/noEmptyInterface: merged by extension declarations
export interface RhoRuntimeModels {}

/** The shared runtime database client: system models plus runtime-added models. */
export type RhoDb = RhoPrismaClient & RhoRuntimeModels;
export type { ReloadResult } from "./reload.ts";
