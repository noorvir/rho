import { eventIterator, oc } from "@orpc/contract";
import * as z from "zod";

const principalSchema = z.object({
	kind: z.enum(["session", "api-token"]),
	id: z.string(),
});

const authSessionSchema = z.object({
	authenticated: z.boolean(),
	principal: principalSchema.nullable(),
});

const appSummarySchema = z.object({
	slug: z.string(),
	name: z.string(),
	clientModuleUrl: z.string(),
	clientStylesUrl: z.string().optional(),
	routes: z.array(z.object({ path: z.string(), label: z.string().optional() })),
	apiBasePath: z.string().optional(),
});

const tableValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const tableColumnSchema = z.object({
	id: z.string(),
	label: z.string(),
	kind: z.enum(["boolean", "date", "enum", "number", "text"]),
	declaredType: z.string(),
	nullable: z.boolean(),
	primaryKey: z.boolean(),
	defaultValue: tableValueSchema,
});
const tableSchema = z.object({
	name: z.string(),
	columns: z.array(tableColumnSchema),
	rows: z.array(z.record(z.string(), tableValueSchema)),
	limit: z.number(),
	offset: z.number(),
});

const attachmentSchema = z.object({
	path: z.string(),
	mimeType: z.string(),
});

const messageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	text: z.string(),
	attachments: z.array(attachmentSchema),
});

const taskSchema = z.object({
	id: z.string(),
	title: z.string(),
	status: z.enum(["queued", "running", "done", "failed"]),
	summary: z.string().nullable(),
	error: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const cronScheduleSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("at"), at: z.string(), timezone: z.string() }),
	z.object({ kind: z.literal("cron"), expression: z.string(), timezone: z.string() }),
]);

const notificationLevelSchema = z.enum(["info", "attention", "urgent"]);

const notificationTargetSchema = z.object({
	type: z.string(),
	id: z.string(),
});

const notificationSchema = z.object({
	id: z.string(),
	key: z.string(),
	extensionId: z.string(),
	defId: z.string(),
	title: z.string(),
	body: z.string(),
	level: notificationLevelSchema,
	target: notificationTargetSchema.nullable(),
	idempotencyKey: z.string(),
	readAt: z.date().nullable(),
	dismissedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const cronSchema = z.object({
	id: z.string(),
	kind: z.enum(["agent", "extension"]),
	title: z.string(),
	schedule: cronScheduleSchema,
	timezone: z.string(),
	enabled: z.boolean(),
	status: z.enum(["not_run", "running", "succeeded", "failed"]),
	purpose: z.enum(["reminder", "scheduled_task"]),
	nextRunAt: z.date(),
	lastRunAt: z.date().nullable(),
	lastError: z.string().nullable(),
	activeRunId: z.string().nullable(),
	instructions: z.string().nullable(),
	extensionId: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const chatEventSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("started") }),
	z.object({ type: z.literal("delta"), text: z.string() }),
	z.object({ type: z.literal("completed"), text: z.string() }),
	z.object({ type: z.literal("error"), error: z.string() }),
]);

const messageInputSchema = z.object({
	conversationId: z.string().min(1),
	sender: z.object({ id: z.string().min(1) }).passthrough(),
	text: z.string(),
	attachments: z.array(z.object({ path: z.string().min(1) })).optional(),
});

const storeUploadSchema = z.object({
	sessionId: z.string().min(1),
	mimeType: z.string().min(1),
	/** Base64-encoded file bytes. */
	data: z.string().min(1),
});

export const httpContract = {
	apps: {
		list: oc.route({ method: "GET", path: "/apps.json" }).output(z.object({ apps: z.array(appSummarySchema) })),
		reload: oc.route({ method: "POST", path: "/reload" }),
	},
	auth: {
		status: oc
			.route({ method: "GET", path: "/api/auth/setup" })
			.output(z.object({ setupRequired: z.boolean() })),
		setup: oc
			.route({ method: "POST", path: "/api/auth/setup" })
			.input(z.object({ ownerToken: z.string().min(1), password: z.string().min(1) }))
			.output(z.object({ authenticated: z.boolean(), principal: principalSchema })),
		login: oc
			.route({ method: "POST", path: "/api/auth/login" })
			.input(z.object({ password: z.string().min(1) }))
			.output(z.object({ authenticated: z.boolean(), principal: principalSchema })),
		session: oc.route({ method: "GET", path: "/api/auth/session" }).output(authSessionSchema),
		logout: oc
			.route({ method: "POST", path: "/api/auth/logout" })
			.output(z.object({ authenticated: z.boolean() })),
		listApiTokens: oc
			.route({ method: "GET", path: "/api/auth/api-tokens" })
			.output(z.object({ tokens: z.array(z.unknown()) })),
		createApiToken: oc
			.route({ method: "POST", path: "/api/auth/api-tokens" })
			.input(z.object({ name: z.string().trim().min(1) }))
			.output(z.unknown()),
		revokeApiToken: oc
			.route({ method: "DELETE", path: "/api/auth/api-tokens/{id}" })
			.input(z.object({ id: z.string().min(1) }))
			.output(z.object({ revoked: z.boolean() })),
		webSession: oc
			.route({ method: "POST", path: "/api/auth/web-session" })
			.output(z.object({ cookieName: z.string(), token: z.string(), expiresAt: z.date() })),
		getToken: oc
			.route({ method: "POST", path: "/api/auth/token/login" })
			.input(z.object({ password: z.string().min(1) }))
			.output(z.unknown()),
		refreshToken: oc
			.route({ method: "POST", path: "/api/auth/token/refresh" })
			.input(z.object({ refreshToken: z.string().min(1) }))
			.output(z.unknown()),
		revokeToken: oc
			.route({ method: "POST", path: "/api/auth/token/logout" })
			.input(z.object({ refreshToken: z.string().min(1) }))
			.output(z.object({ authenticated: z.boolean() })),
	},
	data: {
		listTables: oc
			.route({ method: "GET", path: "/tables" })
			.output(z.object({ tables: z.array(z.object({ name: z.string(), label: z.string() })) })),
		table: oc
			.route({ method: "GET", path: "/tables/{name}" })
			.input(
				z.object({
					name: z.string().min(1),
					limit: z.coerce.number().int().min(1).optional(),
					offset: z.coerce.number().int().min(0).optional(),
					orderBy: z.string().optional(),
					order: z.string().optional(),
				}),
			)
			.output(tableSchema),
	},
	agent: {
		messages: oc
			.route({ method: "GET", path: "/agent/conversations/{id}/messages" })
			.input(z.object({ id: z.string().min(1) }))
			.output(z.object({ messages: z.array(messageSchema) })),
		handleMessage: oc
			.route({ method: "POST", path: "/agent/messages" })
			.input(messageInputSchema)
			.output(z.object({ message: z.unknown() })),
		handleMessageStream: oc
			.route({ method: "POST", path: "/agent/messages:stream" })
			.input(messageInputSchema)
			.output(eventIterator(chatEventSchema)),
		tasks: oc
			.route({ method: "GET", path: "/agent/conversations/{id}/tasks" })
			.input(z.object({ id: z.string().min(1) }))
			.output(z.object({ tasks: z.array(taskSchema) })),
		crons: oc.route({ method: "GET", path: "/agent/crons" }).output(z.object({ crons: z.array(cronSchema) })),
		reminders: oc
			.route({ method: "GET", path: "/agent/reminders" })
			.output(z.object({ reminders: z.array(cronSchema) })),
		notifications: oc
			.route({ method: "GET", path: "/agent/notifications" })
			.output(z.object({ notifications: z.array(notificationSchema) })),
	},
	store: {
		upload: oc
			.route({ method: "POST", path: "/store/uploads" })
			.input(storeUploadSchema)
			.output(z.object({ path: z.string() })),
		download: oc
			.route({ method: "GET", path: "/store/{+path}" })
			.input(z.object({ path: z.string().min(1) }))
			.output(z.instanceof(File)),
	},
};

export type HttpContract = typeof httpContract;
