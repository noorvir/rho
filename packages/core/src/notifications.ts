import type { rho_sys_Notification as NotificationRow } from "./generated/prisma/client.ts";
import type { RhoPrisma } from "./prisma.ts";

export type NotificationLevel = "info" | "attention" | "urgent";

export interface NotificationDefInput {
	id: string;
	title: string;
	prompt: string;
}

export interface NotificationDefRegistration extends NotificationDefInput {
	extensionId: string;
}

interface RegisteredNotificationDef extends NotificationDefRegistration {
	key: string;
}

export interface NotificationTarget {
	type: string;
	id: string;
}

export interface EmitNotificationInput {
	def: string;
	title: string;
	body: string;
	level: NotificationLevel;
	idempotencyKey: string;
	target?: NotificationTarget;
}

export interface EmitNotificationByKeyInput extends Omit<EmitNotificationInput, "def"> {
	key: string;
}

export type EmitNotificationResult =
	| { ok: true; notification: NotificationSummary; created: boolean }
	| { ok: false; error: NotificationEmitError };

export type NotificationEmitError = "unknown_notification_def" | "invalid_notification_input";

export interface NotificationSummary {
	id: string;
	key: string;
	extensionId: string;
	defId: string;
	title: string;
	body: string;
	level: NotificationLevel;
	target: NotificationTarget | null;
	idempotencyKey: string;
	readAt: Date | null;
	dismissedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface NotificationServiceOptions {
	prisma: RhoPrisma;
}

export class NotificationService {
	private readonly prisma: RhoPrisma;
	private defs = new Map<string, RegisteredNotificationDef>();

	constructor(options: NotificationServiceOptions) {
		this.prisma = options.prisma;
	}

	/**
	 * Replaces the in-memory notification definition registry. Definitions are
	 * code-owned and re-supplied on every reload, like cron run functions, so
	 * they live in memory rather than the database.
	 */
	replaceDefs(registrations: NotificationDefRegistration[]): void {
		const next = new Map<string, RegisteredNotificationDef>();
		for (const registration of registrations) {
			const extensionId = registration.extensionId.trim();
			const id = registration.id.trim();
			if (!extensionId || !id) {
				console.warn(`Skipping notification definition with an empty id from extension "${registration.extensionId}".`);
				continue;
			}
			const key = notificationDefKey(extensionId, id);
			next.set(key, { ...registration, extensionId, id, key });
		}
		this.defs = next;
	}

	agentPrompt(): string {
		const defs = [...this.defs.values()].sort((a, b) => a.key.localeCompare(b.key));
		return formatNotificationDefsForAgent(defs);
	}

	async listNotifications(limit = 50): Promise<NotificationSummary[]> {
		const rows = await this.prisma.rho_sys_Notification.findMany({
			where: { dismissedAt: null },
			orderBy: { createdAt: "desc" },
			take: limit,
		});
		return rows.map(notificationSummary);
	}

	async emit(input: EmitNotificationByKeyInput): Promise<EmitNotificationResult> {
		const validInput = validateEmitInput(input);
		if (!validInput.ok) {
			return validInput;
		}

		const def = this.defs.get(input.key);
		if (!def) {
			return { ok: false, error: "unknown_notification_def" };
		}

		const existing = await this.prisma.rho_sys_Notification.findUnique({
			where: {
				defKey_idempotencyKey: {
					defKey: input.key,
					idempotencyKey: input.idempotencyKey,
				},
			},
		});
		if (existing) {
			return { ok: true, notification: notificationSummary(existing), created: false };
		}

		const notification = await this.prisma.rho_sys_Notification.create({
			data: {
				id: `notification_${crypto.randomUUID()}`,
				defKey: def.key,
				extensionId: def.extensionId,
				defId: def.id,
				title: input.title,
				body: input.body,
				level: input.level,
				targetType: input.target?.type,
				targetId: input.target?.id,
				idempotencyKey: input.idempotencyKey,
			},
		});

		return { ok: true, notification: notificationSummary(notification), created: true };
	}
}

export function notificationDefKey(extensionId: string, id: string): string {
	return `${extensionId}:${id}`;
}

function formatNotificationDefsForAgent(defs: RegisteredNotificationDef[]): string {
	if (defs.length === 0) {
		return "No extension notification definitions are registered.";
	}

	const lines = defs.map((def) => `- def: ${def.key}\n  title: ${def.title}\n  prompt: ${def.prompt}`);
	return `Registered Rho notification definitions:\n${lines.join("\n")}`;
}

function notificationSummary(row: NotificationRow): NotificationSummary {
	let target: NotificationTarget | null = null;
	if (row.targetType && row.targetId) {
		target = { type: row.targetType, id: row.targetId };
	}

	return {
		id: row.id,
		key: row.defKey,
		extensionId: row.extensionId,
		defId: row.defId,
		title: row.title,
		body: row.body,
		level: row.level ?? "info",
		target,
		idempotencyKey: row.idempotencyKey ?? "",
		readAt: row.readAt,
		dismissedAt: row.dismissedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function validateEmitInput(input: EmitNotificationByKeyInput): { ok: true } | { ok: false; error: NotificationEmitError } {
	if (!nonEmptyOrNull(input.key)) {
		return { ok: false, error: "invalid_notification_input" };
	}
	if (!nonEmptyOrNull(input.title)) {
		return { ok: false, error: "invalid_notification_input" };
	}
	if (!nonEmptyOrNull(input.body)) {
		return { ok: false, error: "invalid_notification_input" };
	}
	if (!isNotificationLevel(input.level)) {
		return { ok: false, error: "invalid_notification_input" };
	}
	if (!nonEmptyOrNull(input.idempotencyKey)) {
		return { ok: false, error: "invalid_notification_input" };
	}
	if (input.target && (!nonEmptyOrNull(input.target.type) || !nonEmptyOrNull(input.target.id))) {
		return { ok: false, error: "invalid_notification_input" };
	}
	return { ok: true };
}

function isNotificationLevel(value: string): value is NotificationLevel {
	return value === "info" || value === "attention" || value === "urgent";
}

function nonEmptyOrNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}
