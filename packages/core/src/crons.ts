import { Cron } from "croner";
import type { Prisma, rho_sys_Cron as CronRow } from "./generated/prisma/client.ts";
import type { RhoPrisma } from "./prisma.ts";
import type { TaskRunner } from "./tasks.ts";

export type CronSchedule = AtCronSchedule | ExpressionCronSchedule;

export interface AtCronSchedule {
	kind: "at";
	at: string;
	timezone: string;
}

export interface ExpressionCronSchedule {
	kind: "cron";
	expression: string;
	timezone: string;
}

export type CronListScope = "all" | "agent" | "extension";
export type CronKind = "agent" | "extension";
export type CronStatus = "not_run" | "running" | "succeeded" | "failed";

export interface CronSummary {
	id: string;
	kind: CronKind;
	title: string;
	schedule: CronSchedule;
	timezone: string;
	enabled: boolean;
	status: CronStatus;
	nextRunAt: Date;
	lastRunAt: Date | null;
	lastError: string | null;
	activeRunId: string | null;
	instructions: string | null;
	extensionId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface AgentCronDeliveryTarget {
	conversationKey: string;
	channelId: string;
	targetType: string;
	targetId: string;
}

interface AgentCronFields extends AgentCronDeliveryTarget {
	instructions: string;
}

export interface CreateAgentCronInput extends AgentCronDeliveryTarget {
	title: string;
	schedule: CronSchedule;
	enabled: boolean;
	instructions: string;
}

export interface UpdateCronInput {
	id: string;
	title?: string;
	schedule?: CronSchedule;
	enabled?: boolean;
	instructions?: string;
}

export interface CronContext {
	db: RhoPrisma;
	cron: CronSummary;
}

export interface CronRegistration {
	id: string;
	extensionId: string;
	title: string;
	schedule: CronSchedule;
	enabled: boolean;
	run(ctx: CronContext): Promise<void>;
}

export type CronInput = Omit<CronRegistration, "extensionId">;

export interface CronSchedulerOptions {
	prisma: RhoPrisma;
	tasks: TaskRunner;
}

export class CronScheduler {
	private readonly prisma: RhoPrisma;
	private readonly tasks: TaskRunner;
	private readonly runs = new Map<string, CronRegistration>();
	private readonly jobs = new Map<string, Cron>();
	private readonly activeRuns = new Set<Promise<void>>();
	private started = false;

	constructor(options: CronSchedulerOptions) {
		this.prisma = options.prisma;
		this.tasks = options.tasks;
	}

	async start(): Promise<void> {
		this.started = true;
		await this.recoverInterruptedRuns();
		await this.rescheduleCrons();
	}

	async stop(): Promise<void> {
		this.started = false;
		this.stopJobs();
		await Promise.all(this.activeRuns);
	}

	async replaceCrons(registrations: CronRegistration[]): Promise<void> {
		const nextRuns = new Map<string, CronRegistration>();
		for (const registration of registrations) {
			validateRegistration(registration);
			if (nextRuns.has(registration.id)) {
				throw new Error(`Duplicate extension cron id: ${registration.id}`);
			}
			nextRuns.set(registration.id, registration);
		}

		const now = new Date();
		const seenIds = new Set<string>();

		for (const registration of registrations) {
			seenIds.add(registration.id);
			const existing = await this.prisma.rho_sys_Cron.findUnique({ where: { id: registration.id } });
			if (existing && existing.kind !== "extension") {
				throw new Error(`Extension cron id collides with an agent cron: ${registration.id}`);
			}

			const nextRunAt = getNextRun(registration.schedule, now);
			const enabled = existing ? existing.enabled : registration.enabled;

			await this.prisma.rho_sys_Cron.upsert({
				where: { id: registration.id },
				create: {
					id: registration.id,
					kind: "extension",
					title: registration.title,
					scheduleKind: registration.schedule.kind,
					schedule: scheduleValue(registration.schedule),
					timezone: registration.schedule.timezone,
					enabled,
					status: "not_run",
					nextRunAt,
					extensionId: registration.extensionId,
				},
				update: {
					title: registration.title,
					scheduleKind: registration.schedule.kind,
					schedule: scheduleValue(registration.schedule),
					timezone: registration.schedule.timezone,
					nextRunAt,
					extensionId: registration.extensionId,
					instructions: null,
					conversationKey: null,
					channelId: null,
					targetType: null,
					targetId: null,
				},
			});
		}

		const currentCrons = await this.prisma.rho_sys_Cron.findMany({ where: { kind: "extension" } });
		for (const cron of currentCrons) {
			if (seenIds.has(cron.id)) {
				continue;
			}
			await this.prisma.rho_sys_Cron.update({
				where: { id: cron.id },
				data: {
					enabled: false,
					status: "failed",
					activeRunId: null,
					lastError: "Extension cron is not registered by loaded extension code.",
				},
			});
		}

		this.runs.clear();
		for (const registration of nextRuns.values()) {
			this.runs.set(registration.id, registration);
		}
		await this.rescheduleCrons();
	}

	async listCrons(scope: CronListScope): Promise<CronSummary[]> {
		await this.syncAgentCronTasks();
		const where = cronListWhere(scope);
		const crons = await this.prisma.rho_sys_Cron.findMany({
			where,
			orderBy: { createdAt: "desc" },
		});

		return crons.map(cronSummary);
	}

	async createAgentCron(input: CreateAgentCronInput): Promise<CronSummary> {
		validateCreateAgentCron(input);
		const id = `cron_${crypto.randomUUID()}`;
		const nextRunAt = getNextRun(input.schedule, new Date());

		const cron = await this.prisma.rho_sys_Cron.create({
			data: {
				id,
				kind: "agent",
				title: input.title,
				scheduleKind: input.schedule.kind,
				schedule: scheduleValue(input.schedule),
				timezone: input.schedule.timezone,
				enabled: input.enabled,
				status: "not_run",
				nextRunAt,
				instructions: input.instructions,
				conversationKey: input.conversationKey,
				channelId: input.channelId,
				targetType: input.targetType,
				targetId: input.targetId,
			},
		});
		await this.rescheduleCrons();
		return cronSummary(cron);
	}

	async updateCron(input: UpdateCronInput): Promise<CronSummary> {
		validateUpdateCron(input);
		const existing = await this.requireCron(input.id);
		if (existing.kind === "extension") {
			return this.updateRegisteredCron(existing, input);
		}
		return this.updateAgentCron(existing, input);
	}

	private async updateAgentCron(existing: CronRow, input: UpdateCronInput): Promise<CronSummary> {
		const schedule = input.schedule ?? rowSchedule(existing);
		const nextRunAt =
			input.schedule || input.enabled === true ? getNextRun(schedule, new Date()) : existing.nextRunAt;
		const cron = await this.prisma.rho_sys_Cron.update({
			where: { id: input.id },
			data: {
				title: input.title ?? existing.title,
				scheduleKind: schedule.kind,
				schedule: scheduleValue(schedule),
				timezone: schedule.timezone,
				enabled: input.enabled ?? existing.enabled,
				nextRunAt,
				status: input.schedule ? "not_run" : existing.status,
				lastError: input.schedule ? null : existing.lastError,
				activeRunId: input.enabled === false ? null : existing.activeRunId,
				instructions: input.instructions ?? existing.instructions,
			},
		});
		await this.rescheduleCrons();
		return cronSummary(cron);
	}

	private async updateRegisteredCron(existing: CronRow, input: UpdateCronInput): Promise<CronSummary> {
		if (input.title !== undefined || input.schedule !== undefined || input.instructions !== undefined) {
			throw new Error("Extension cron definitions are owned by extension code; only enabled can be updated");
		}
		if (input.enabled === undefined) {
			throw new Error("Extension cron update requires enabled");
		}

		const schedule = rowSchedule(existing);
		const nextRunAt = input.enabled ? getNextRun(schedule, new Date()) : existing.nextRunAt;
		const cron = await this.prisma.rho_sys_Cron.update({
			where: { id: input.id },
			data: {
				enabled: input.enabled,
				nextRunAt,
				activeRunId: input.enabled ? existing.activeRunId : null,
			},
		});
		await this.rescheduleCrons();
		return cronSummary(cron);
	}

	private async recoverInterruptedRuns(): Promise<void> {
		await this.prisma.rho_sys_Cron.updateMany({
			where: { kind: "extension", activeRunId: { not: null } },
			data: {
				status: "failed",
				activeRunId: null,
				lastError: "interrupted by a server restart",
			},
		});
		await this.syncAgentCronTasks();
	}

	private async rescheduleCrons(): Promise<void> {
		this.stopJobs();
		if (!this.started) {
			return;
		}

		await this.syncAgentCronTasks();
		const crons = await this.prisma.rho_sys_Cron.findMany({
			where: { enabled: true },
			orderBy: { nextRunAt: "asc" },
		});
		const now = new Date();

		for (const cron of crons) {
			await this.scheduleCron(cron, now);
		}
	}

	private async scheduleCron(cron: CronRow, now: Date): Promise<void> {
		if (cron.nextRunAt <= now && !cron.activeRunId) {
			await this.fireCron(cron, now);
			const updated = await this.prisma.rho_sys_Cron.findUnique({ where: { id: cron.id } });
			if (!updated || !updated.enabled) {
				return;
			}
			cron = updated;
		}

		const schedule = rowSchedule(cron);
		const pattern = schedule.kind === "at" ? parseDate(schedule.at, "schedule.at") : schedule.expression;
		const options = schedule.kind === "cron" ? { timezone: schedule.timezone } : undefined;
		const job = new Cron(pattern, options, () => this.runScheduledCron(cron.id));
		const nextRunAt = job.nextRun(now);
		if (!nextRunAt) {
			job.stop();
			return;
		}

		this.jobs.set(cron.id, job);
		if (nextRunAt.getTime() !== cron.nextRunAt.getTime()) {
			await this.prisma.rho_sys_Cron.update({ where: { id: cron.id }, data: { nextRunAt } });
		}
	}

	private runScheduledCron(id: string): Promise<void> {
		if (!this.started) {
			return Promise.resolve();
		}

		const run = this.fireCronById(id).catch((error) => {
			console.error(`rho cron ${id} failed to run:`, error);
		});
		this.activeRuns.add(run);
		return run.finally(() => {
			this.activeRuns.delete(run);
		});
	}

	private async fireCronById(id: string): Promise<void> {
		const cron = await this.prisma.rho_sys_Cron.findUnique({ where: { id } });
		if (!cron || !cron.enabled) {
			this.stopJob(id);
			return;
		}

		await this.fireCron(cron, new Date());
		if (cron.scheduleKind === "at") {
			this.stopJob(id);
		}
	}

	private stopJobs(): void {
		for (const job of this.jobs.values()) {
			job.stop();
		}
		this.jobs.clear();
	}

	private stopJob(id: string): void {
		const job = this.jobs.get(id);
		if (!job) {
			return;
		}
		job.stop();
		this.jobs.delete(id);
	}

	private async syncAgentCronTasks(): Promise<void> {
		const runningCrons = await this.prisma.rho_sys_Cron.findMany({
			where: { kind: "agent", activeRunId: { not: null } },
		});

		for (const cron of runningCrons) {
			await this.syncAgentCronTask(cron);
		}
	}

	private async syncAgentCronTask(cron: CronRow): Promise<boolean> {
		if (!cron.activeRunId) {
			return false;
		}

		const task = await this.prisma.rho_sys_Task.findUnique({ where: { id: cron.activeRunId } });
		if (!task) {
			await this.prisma.rho_sys_Cron.update({
				where: { id: cron.id },
				data: {
					status: "failed",
					activeRunId: null,
					lastError: `Active task ${cron.activeRunId} no longer exists`,
				},
			});
			return false;
		}

		if (task.status === "queued" || task.status === "running") {
			return true;
		}

		const status = task.status === "done" ? "succeeded" : "failed";
		const lastError = task.status === "failed" ? (task.error ?? "Task failed") : null;

		await this.prisma.rho_sys_Cron.update({
			where: { id: cron.id },
			data: { status, activeRunId: null, lastError },
		});

		return false;
	}

	private async fireCron(cron: CronRow, now: Date): Promise<void> {
		if (cron.activeRunId) {
			const stillRunning = cron.kind === "agent" ? await this.syncAgentCronTask(cron) : true;
			if (stillRunning) {
				await this.advanceSkippedOverlap(cron, now);
				return;
			}
		}

		const schedule = rowSchedule(cron);
		const nextRunAt =
			schedule.kind === "at" ? parseDate(schedule.at, "schedule.at") : getNextRun(schedule, now);
		const runId = `run_${crypto.randomUUID()}`;
		const enabled = schedule.kind === "at" ? false : cron.enabled;

		await this.prisma.rho_sys_Cron.update({
			where: { id: cron.id },
			data: {
				status: "running",
				activeRunId: runId,
				lastRunAt: now,
				lastError: null,
				nextRunAt,
				enabled,
			},
		});

		if (cron.kind === "extension") {
			await this.runRegisteredCron(cron, runId);
			return;
		}

		await this.enqueueAgentCron(cron, runId);
	}

	private async advanceSkippedOverlap(cron: CronRow, now: Date): Promise<void> {
		const schedule = rowSchedule(cron);
		if (schedule.kind === "at") {
			await this.prisma.rho_sys_Cron.update({ where: { id: cron.id }, data: { enabled: false } });
			return;
		}

		await this.prisma.rho_sys_Cron.update({
			where: { id: cron.id },
			data: { nextRunAt: getNextRun(schedule, now) },
		});
	}

	private async runRegisteredCron(cron: CronRow, runId: string): Promise<void> {
		const run = this.runs.get(cron.id);
		if (!run) {
			await this.markFailed(cron.id, runId, "Extension cron is not registered by loaded extension code.");
			return;
		}

		try {
			await run.run({ db: this.prisma, cron: cronSummary(cron) });
			await this.markSucceeded(cron.id, runId);
		} catch (error) {
			await this.markFailed(cron.id, runId, errorMessage(error));
		}
	}

	private async enqueueAgentCron(cron: CronRow, runId: string): Promise<void> {
		const agentCron = agentCronFields(cron);
		if (!agentCron) {
			await this.markFailed(cron.id, runId, "Agent cron is missing delivery fields.");
			return;
		}

		const task = await this.tasks.create({
			conversationKey: agentCron.conversationKey,
			channelId: agentCron.channelId,
			targetType: agentCron.targetType,
			targetId: agentCron.targetId,
			title: cron.title,
			instructions: agentCron.instructions,
		});

		await this.prisma.rho_sys_Cron.update({
			where: { id: cron.id },
			data: { activeRunId: task.id },
		});
	}

	private async markSucceeded(id: string, runId: string): Promise<void> {
		const updated = await this.prisma.rho_sys_Cron.updateMany({
			where: { id, activeRunId: runId },
			data: { status: "succeeded", activeRunId: null, lastError: null },
		});
		if (updated.count === 0) {
			console.error(`rho cron ${id} finished but no active run ${runId} was recorded`);
		}
	}

	private async markFailed(id: string, runId: string, message: string): Promise<void> {
		const updated = await this.prisma.rho_sys_Cron.updateMany({
			where: { id, activeRunId: runId },
			data: { status: "failed", activeRunId: null, lastError: message },
		});
		if (updated.count === 0) {
			console.error(`rho cron ${id} failed but no active run ${runId} was recorded`);
		}
	}

	private async requireCron(id: string): Promise<CronRow> {
		const cron = await this.prisma.rho_sys_Cron.findUnique({ where: { id } });
		if (!cron) {
			throw new Error(`Cron ${id} does not exist`);
		}
		return cron;
	}
}

export function getDefaultTimezone(): string {
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return timezone || "UTC";
}

export function getNextRun(schedule: CronSchedule, after: Date): Date {
	validateSchedule(schedule);
	if (schedule.kind === "at") {
		return parseDate(schedule.at, "schedule.at");
	}

	const job = new Cron(schedule.expression, { timezone: schedule.timezone, paused: true });
	const next = job.nextRun(after);
	if (!next) {
		throw new Error(`Cron expression has no future run: ${schedule.expression}`);
	}
	return next;
}

function cronListWhere(scope: CronListScope): Prisma.rho_sys_CronWhereInput {
	if (scope === "agent") {
		return { kind: "agent" };
	}
	if (scope === "extension") {
		return { kind: "extension" };
	}
	return {};
}

function rowSchedule(row: CronRow): CronSchedule {
	if (row.scheduleKind === "at") {
		return { kind: "at", at: row.schedule, timezone: row.timezone };
	}
	return { kind: "cron", expression: row.schedule, timezone: row.timezone };
}

function scheduleValue(schedule: CronSchedule): string {
	if (schedule.kind === "at") {
		return parseDate(schedule.at, "schedule.at").toISOString();
	}
	return nonEmpty(schedule.expression, "schedule.expression");
}

function agentCronFields(cron: CronRow): AgentCronFields | null {
	if (!cron.instructions || !cron.conversationKey || !cron.channelId || !cron.targetType || !cron.targetId) {
		return null;
	}
	return {
		instructions: cron.instructions,
		conversationKey: cron.conversationKey,
		channelId: cron.channelId,
		targetType: cron.targetType,
		targetId: cron.targetId,
	};
}

function cronSummary(cron: CronRow): CronSummary {
	return {
		id: cron.id,
		kind: cron.kind,
		title: cron.title,
		schedule: rowSchedule(cron),
		timezone: cron.timezone,
		enabled: cron.enabled,
		status: cron.status,
		nextRunAt: cron.nextRunAt,
		lastRunAt: cron.lastRunAt,
		lastError: cron.lastError,
		activeRunId: cron.activeRunId,
		instructions: cron.instructions,
		extensionId: cron.extensionId,
		createdAt: cron.createdAt,
		updatedAt: cron.updatedAt,
	};
}

function validateCreateAgentCron(input: CreateAgentCronInput): void {
	nonEmpty(input.title, "title");
	nonEmpty(input.instructions, "instructions");
	nonEmpty(input.conversationKey, "conversationKey");
	nonEmpty(input.channelId, "channelId");
	nonEmpty(input.targetType, "targetType");
	nonEmpty(input.targetId, "targetId");
	validateSchedule(input.schedule);
}

function validateUpdateCron(input: UpdateCronInput): void {
	nonEmpty(input.id, "id");
	if (
		input.title === undefined &&
		input.schedule === undefined &&
		input.enabled === undefined &&
		input.instructions === undefined
	) {
		throw new Error("At least one cron field must be provided to update");
	}
	if (input.title !== undefined) {
		nonEmpty(input.title, "title");
	}
	if (input.instructions !== undefined) {
		nonEmpty(input.instructions, "instructions");
	}
	if (input.schedule !== undefined) {
		validateSchedule(input.schedule);
	}
}

function validateRegistration(input: CronRegistration): void {
	nonEmpty(input.id, "id");
	nonEmpty(input.extensionId, "extensionId");
	nonEmpty(input.title, "title");
	validateSchedule(input.schedule);
}

function validateSchedule(schedule: CronSchedule): void {
	validateTimezone(schedule.timezone);
	if (schedule.kind === "at") {
		parseDate(schedule.at, "schedule.at");
		return;
	}

	nonEmpty(schedule.expression, "schedule.expression");
	const job = new Cron(schedule.expression, { timezone: schedule.timezone, paused: true });
	const next = job.nextRun(new Date());
	if (!next) {
		throw new Error(`Cron expression has no future run: ${schedule.expression}`);
	}
}

function validateTimezone(timezone: string): void {
	const value = nonEmpty(timezone, "timezone");
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
	} catch (error) {
		throw new Error(`Invalid timezone: ${value}`, { cause: error });
	}
}

function parseDate(value: string, field: string): Date {
	const parsed = new Date(nonEmpty(value, field));
	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`${field} must be a valid ISO date`);
	}
	return parsed;
}

function nonEmpty(value: string, field: string): string {
	const trimmed = value.trim();
	if (trimmed === "") {
		throw new Error(`${field} is required`);
	}
	return trimmed;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
