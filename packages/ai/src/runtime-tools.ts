import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export interface BackgroundTaskRequest {
	title: string;
	instructions: string;
}

export type RhoCronSchedule = RhoAtCronSchedule | RhoExpressionCronSchedule;

export interface RhoAtCronSchedule {
	kind: "at";
	at: string;
	timezone: string;
}

export interface RhoExpressionCronSchedule {
	kind: "cron";
	expression: string;
	timezone: string;
}

export type RhoCronScope = "all" | "agent" | "extension";
export type RhoNotificationLevel = "info" | "attention" | "urgent";
export type RhoCronKind = "agent" | "extension";
export type RhoCronStatus = "not_run" | "running" | "succeeded" | "failed";
export type RhoCronPurpose = "reminder" | "scheduled_task";

export interface RhoCronSummary {
	id: string;
	kind: RhoCronKind;
	title: string;
	schedule: RhoCronSchedule;
	timezone: string;
	enabled: boolean;
	status: RhoCronStatus;
	purpose: RhoCronPurpose;
	nextRunAt: Date;
	lastRunAt: Date | null;
	lastError: string | null;
	activeRunId: string | null;
	instructions: string | null;
	extensionId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface RhoCronCreateRequest {
	title: string;
	schedule: RhoCronSchedule;
	enabled: boolean;
	purpose: RhoCronPurpose;
	instructions: string;
}

export interface RhoCronUpdateRequest {
	id: string;
	title?: string;
	schedule?: RhoCronSchedule;
	enabled?: boolean;
	purpose?: RhoCronPurpose;
	instructions?: string;
}

export interface RhoNotificationSendRequest {
	key: string;
	title: string;
	body: string;
	level: RhoNotificationLevel;
	idempotencyKey: string;
	target?: {
		type: string;
		id: string;
	};
}

export interface RhoNotificationSendResult {
	ok: boolean;
	notificationId?: string;
	error?: string;
}

const cronScheduleParams = Type.Union([
	Type.Object({
		kind: Type.Literal("at"),
		at: Type.String({ description: "ISO date/time when the cron should fire once." }),
		timezone: Type.String({ description: "Concrete IANA timezone, e.g. America/Los_Angeles." }),
	}),
	Type.Object({
		kind: Type.Literal("cron"),
		expression: Type.String({ description: "Cron expression for recurring schedules, e.g. '0 9 * * *'." }),
		timezone: Type.String({ description: "Concrete IANA timezone, e.g. America/Los_Angeles." }),
	}),
]);

const notificationSendParams = Type.Object({
	key: Type.String({ description: "Registered notification definition key from the current agent context." }),
	title: Type.String({ description: "Specific notification title to show the user." }),
	body: Type.String({ description: "Specific notification body to show the user." }),
	level: Type.Union([Type.Literal("info"), Type.Literal("attention"), Type.Literal("urgent")]),
	idempotencyKey: Type.String({ description: "Stable key that prevents duplicate notifications." }),
	target: Type.Optional(
		Type.Object({
			type: Type.String({ description: "Optional target object type, such as plant." }),
			id: Type.String({ description: "Optional target object id." }),
		}),
	),
});

const backgroundTaskParams = Type.Object({
	title: Type.String({ description: "Short user-facing name for the task, e.g. 'Build the todo list app'" }),
	instructions: Type.String({
		description:
			"Complete instructions for the worker agent: what to build or change, relevant context from this conversation, and what the outcome should be. The worker cannot see this conversation.",
	}),
});

/**
 * Agent extension that registers the background_task tool. The provided
 * callback creates the durable task and returns its id; the runtime runs the
 * task and delivers the outcome to the conversation when it finishes.
 */
export function backgroundTaskExtension(
	start: (request: BackgroundTaskRequest) => Promise<{ taskId: string }>,
): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "background_task",
			label: "Background Task",
			description:
				"Delegate implementation work to a background agent with full tools. This is the only way to build or change anything from a conversation — apps, extensions, files, schema, installs — and the right way to run any work over about a minute. Never refuse buildable requests because this conversation lacks write tools; delegate them here instead. " +
				"The task runs after this reply ends and its outcome is delivered to the user automatically. " +
				"Write a short acknowledgement and rough time expectation before this tool call whenever the model/provider supports text before tools; after calling this, do not add more user-facing text.",
			promptSnippet:
				"Delegate building/changing anything (and other long work) to a background task; the user is notified when it finishes",
			promptGuidelines: [
				"To build or change anything, or for work over about a minute, first reply with one or two plain-language acknowledgement sentences, then call background_task in the same turn. No technical steps or jargon. Do not attempt the work in the conversation and do not refuse because this conversation lacks write tools.",
			],
			parameters: backgroundTaskParams,
			async execute(_toolCallId, params) {
				const result = await start({ title: params.title, instructions: params.instructions });
				return {
					content: [
						{
							type: "text",
							text: `Background task ${result.taskId} started. Reply to the user with a short acknowledgement now; the outcome will be delivered to them automatically when the task finishes.`,
						},
					],
					details: result,
				};
			},
		});
	};
}

export function rhoNotificationsExtension(
	registeredDefs: () => string,
	send: (request: RhoNotificationSendRequest) => Promise<RhoNotificationSendResult>,
): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_notification_send",
			label: "Send Rho notification",
			description:
				"Send an in-app Rho notification using a registered extension notification definition. " +
				"Only use definition keys listed below. If no matching definition is listed, do not send a notification.\n\n" +
				registeredDefs(),
			promptSnippet: "Send an in-app Rho notification using a registered extension notification definition",
			parameters: notificationSendParams,
			async execute(_toolCallId, params) {
				const result = await send({
					key: params.key,
					title: params.title,
					body: params.body,
					level: params.level,
					idempotencyKey: params.idempotencyKey,
					target: params.target,
				});
				if (!result.ok) {
					return {
						content: [{ type: "text", text: `Notification was not sent: ${result.error ?? "unknown_error"}` }],
						details: result,
					};
				}

				return {
					content: [{ type: "text", text: `Notification ${result.notificationId ?? ""} sent.` }],
					details: result,
				};
			},
		});
	};
}

export function rhoCronsExtension(listCrons: (scope: RhoCronScope) => Promise<RhoCronSummary[]>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_crons",
			label: "Rho crons",
			description:
				"List scheduled Rho crons. Use this before changing a reminder or scheduled task. Scope 'agent' lists user-created reminder/work crons; scope 'extension' lists extension-registered crons; scope 'all' lists both.",
			promptSnippet: "List scheduled Rho crons and reminders",
			parameters: Type.Object({
				scope: Type.Union([Type.Literal("all"), Type.Literal("agent"), Type.Literal("extension")]),
			}),
			async execute(_toolCallId, params) {
				const crons = await listCrons(params.scope);
				const text = formatCrons(crons);
				return { content: [{ type: "text", text }], details: { crons } };
			},
		});
	};
}

export function rhoCronCreateExtension(
	createCron: (request: RhoCronCreateRequest) => Promise<{ id: string }>,
	defaultTimezone: string,
): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_cron_create",
			label: "Create Rho cron",
			description:
				`Create an agent cron/reminder. Use purpose 'reminder' for alarms and reminders the user should see in a reminders list; use 'scheduled_task' for scheduled agent work that should not appear as a reminder. The cron id is generated and returned. If the user does not specify a timezone, use ${defaultTimezone}. For relative one-shot reminders, compute an ISO date and use kind 'at'.`,
			promptSnippet: "Create a scheduled reminder or agent cron",
			promptGuidelines: [
				"For explicit reminders or scheduled follow-ups, create an agent cron with rho_cron_create instead of using background_task, sleeps, or polling.",
			],
			parameters: Type.Object({
				title: Type.String({ description: "Short user-facing title for the cron." }),
				schedule: cronScheduleParams,
				enabled: Type.Boolean({ description: "Whether the cron should be active immediately." }),
				purpose: Type.Union([Type.Literal("reminder"), Type.Literal("scheduled_task")]),
				instructions: Type.String({ description: "What the agent should do when this cron fires." }),
			}),
			async execute(_toolCallId, params) {
				const result = await createCron({
					title: params.title,
					schedule: params.schedule,
					enabled: params.enabled,
					purpose: params.purpose,
					instructions: params.instructions,
				});
				return {
					content: [{ type: "text", text: `Cron ${result.id} created.` }],
					details: result,
				};
			},
		});
	};
}

export function rhoCronUpdateExtension(
	updateCron: (request: RhoCronUpdateRequest) => Promise<{ id: string }>,
	defaultTimezone: string,
): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_cron_update",
			label: "Update Rho cron",
			description:
				`Partially update an existing cron. List crons first; do not guess ids. Provide only fields the user wants changed. Agent crons can update title, schedule, enabled, purpose, and instructions. Extension crons can only update enabled because their definitions are owned by extension code. If setting a schedule and the user does not specify a timezone, use ${defaultTimezone}.`,
			promptSnippet: "Partially update an existing scheduled cron",
			parameters: Type.Object({
				id: Type.String({ description: "Existing cron id returned by rho_crons or rho_cron_create." }),
				title: Type.Optional(Type.String({ description: "New title." })),
				schedule: Type.Optional(cronScheduleParams),
				enabled: Type.Optional(Type.Boolean({ description: "Whether the cron should be active." })),
				purpose: Type.Optional(Type.Union([Type.Literal("reminder"), Type.Literal("scheduled_task")])),
				instructions: Type.Optional(Type.String({ description: "New instructions." })),
			}),
			async execute(_toolCallId, params) {
				const result = await updateCron({
					id: params.id,
					title: params.title,
					schedule: params.schedule,
					enabled: params.enabled,
					purpose: params.purpose,
					instructions: params.instructions,
				});
				return { content: [{ type: "text", text: `Cron ${result.id} updated.` }], details: result };
			},
		});
	};
}

function formatCrons(crons: RhoCronSummary[]): string {
	if (crons.length === 0) {
		return "No crons are scheduled.";
	}

	return crons
		.map((cron) => {
			const enabled = cron.enabled ? "enabled" : "disabled";
			const owner = cron.kind === "extension" ? `extension:${cron.extensionId ?? "unknown"}` : `agent:${cron.purpose}`;
			const next = cron.nextRunAt.toISOString();
			const error = cron.lastError ? `, error: ${cron.lastError}` : "";
			return `- ${cron.id}: ${cron.title} (${owner}, ${enabled}, ${cron.status}, ${formatSchedule(cron.schedule)}, next ${next}${error})`;
		})
		.join("\n");
}

function formatSchedule(schedule: RhoCronSchedule): string {
	if (schedule.kind === "at") {
		return `at ${schedule.at} ${schedule.timezone}`;
	}
	return `cron ${schedule.expression} ${schedule.timezone}`;
}

/**
 * Agent extension that registers the rho_query tool: SQL data access to the
 * shared runtime database for realtime conversation turns — reads and row
 * writes. Schema statements and writes to rho_sys_* tables are rejected;
 * structural changes go through background agents.
 */
export function rhoQueryExtension(query: (sql: string) => Promise<string>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_query",
			label: "Rho data",
			description:
				"Run one SQL statement (SQLite) against the user's shared database to read or change their data: SELECT, INSERT, UPDATE, DELETE. Use it to answer data questions and to save or fix data directly (add a contact, complete a todo). Schema changes (CREATE/ALTER/DROP) are rejected — those happen through background agents. Inspect a table first with PRAGMA table_info(name) when unsure of columns.",
			promptSnippet:
				"Read and change the user's data with SQL; schema changes are rejected and go through background agents",
			parameters: Type.Object({
				sql: Type.String({ description: "A single SQL data statement (SELECT/INSERT/UPDATE/DELETE/PRAGMA)." }),
			}),
			async execute(_toolCallId, params) {
				const rows = await query(params.sql);
				return { content: [{ type: "text", text: rows }], details: undefined };
			},
		});
	};
}

export interface RhoAppSummary {
	name: string;
	slug: string;
	routes: Array<{ path: string; label?: string }>;
}

/**
 * Agent extension that registers the rho_apps tool: an instant listing of the
 * apps currently installed in the runtime. Channel turns have no filesystem
 * tools, so this is how they answer "what apps do I have" without spelunking.
 */
export function rhoAppsExtension(listApps: () => Promise<RhoAppSummary[]>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_apps",
			label: "Rho apps",
			description:
				"List the apps currently installed in this Rho runtime, with each app's name and screens. Use this to answer questions about what apps the user has; never inspect files to find this out.",
			promptSnippet: "List the apps installed in this Rho runtime",
			parameters: Type.Object({}),
			async execute() {
				const apps = await listApps();
				if (apps.length === 0) {
					return { content: [{ type: "text", text: "No apps are installed yet." }], details: undefined };
				}
				const text = apps
					.map((app) => {
						const screens = app.routes
							.map((route) => route.label)
							.filter((label): label is string => Boolean(label))
							.join(", ");
						return screens ? `- ${app.name} (screens: ${screens})` : `- ${app.name}`;
					})
					.join("\n");
				return { content: [{ type: "text", text }], details: undefined };
			},
		});
	};
}

/**
 * Agent extension that registers the rho_validate_schema tool, wired to the
 * same preflight checks as rho_migrate but without applying to the live
 * database. Returns a human-readable result summary to the model.
 */
export function rhoValidateSchemaExtension(validate: (name: string) => Promise<string>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_validate_schema",
			label: "Validate Rho schema",
			description:
				"Validate a runtime database schema change after editing the runtime schema.prisma, without applying it to the live database: checks the migration on a snapshot copy and rejects changes that would touch rho_sys_* system tables. Use this for preflight only; call rho_migrate when ready to apply.",
			promptSnippet: "Validate the Rho database schema on a copy without applying it live",
			parameters: Type.Object({
				name: Type.String({ description: "Short snake_case migration name, e.g. add_books" }),
			}),
			async execute(_toolCallId, params) {
				const summary = await validate(params.name);
				return { content: [{ type: "text", text: summary }], details: undefined };
			},
		});
	};
}

/**
 * Agent extension that registers the rho_migrate tool, wired to the runtime's
 * safe schema-migration flow (validate on a copy, apply live, regenerate,
 * reload). Returns a human-readable result summary to the model.
 */
export function rhoMigrateExtension(migrate: (name: string) => Promise<string>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_migrate",
			label: "Migrate Rho schema",
			description:
				"Apply a runtime database schema change safely after editing the runtime schema.prisma: validates the migration on a copy of the live database, applies it live, regenerates the client, and reloads the runtime so new models are usable immediately. Use this instead of running prisma commands manually. Never edit or remove rho_sys_* models.",
			promptSnippet: "Safely migrate the Rho database after editing the runtime schema",
			parameters: Type.Object({
				name: Type.String({ description: "Short snake_case migration name, e.g. add_books" }),
			}),
			async execute(_toolCallId, params) {
				const summary = await migrate(params.name);
				return { content: [{ type: "text", text: summary }], details: undefined };
			},
		});
	};
}

/**
 * Agent extension that registers the rho_reload tool, wired to the runtime's
 * extension reload. Returns a human-readable result summary to the model.
 */
export function rhoReloadExtension(reload: () => Promise<string>): ExtensionFactory {
	return (pi: ExtensionAPI) => {
		pi.registerTool({
			name: "rho_reload",
			label: "Reload Rho",
			description:
				"Reload the Rho runtime so newly created or edited extensions become visible in the user's apps, and swap in the regenerated database client after schema changes. Call after creating or changing an extension or running a migration. Never restart the rho server instead — it hosts this session.",
			promptSnippet: "Reload the Rho runtime to apply new or edited extensions and schema changes",
			parameters: Type.Object({}),
			async execute() {
				const summary = await reload();
				return { content: [{ type: "text", text: summary }], details: undefined };
			},
		});
	};
}
