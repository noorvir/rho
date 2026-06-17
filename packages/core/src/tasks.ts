import { existsSync } from "node:fs";
import {
	appendConversationMessage,
	type RhoAgentExtensionSource,
	runTaskSession,
	type StateManager,
} from "@rho/ai";
import type { rho_sys_Task as Task } from "./generated/prisma/client.ts";
import type { RhoPrisma } from "./prisma.ts";

export interface CreateTaskInput {
	conversationKey: string;
	channelId: string;
	targetType: string;
	targetId: string;
	title: string;
	instructions: string;
}

export interface TaskRunnerOptions {
	prisma: RhoPrisma;
	state: StateManager;
	/** Absolute working directory for task agent sessions. */
	cwd: string;
	/** Absolute agent config directory. */
	agentDir: string;
	/** Absolute directory for task session files. */
	sessionsDir: string;
	/** Live agent extensions for task sessions (rho_context, rho_reload, extension tools). */
	agentExtensions: () => RhoAgentExtensionSource[];
	/** Serializes writes to conversation sessions against active chat turns. */
	conversations: KeyedMutex;
	/** Reasoning effort for task sessions; defaults to medium. */
	taskThinkingLevel?: "minimal" | "low" | "medium" | "high";
	/** Overrides the settings-default model for task sessions. */
	taskModel?: { provider: string; modelId: string };
	/** Live resolver for task model + thinking, read per task so Settings changes apply without a restart. */
	resolveTaskModel?: () => { model?: { provider: string; modelId: string }; thinkingLevel?: "minimal" | "low" | "medium" | "high" } | undefined;
	pollIntervalMs?: number;
}

const maxAttempts = 3;
const heartbeatIntervalMs = 15_000;
const retryBackoffMs = [30_000, 120_000];

/**
 * Durable in-process runner for background tasks. Tasks live in the shared
 * database; each task runs in its own pi session whose file is the resume
 * checkpoint. Every terminal transition delivers an outcome message to the
 * originating conversation — failures included, silence is a bug.
 */
export class TaskRunner {
	private readonly options: TaskRunnerOptions;
	private readonly pollIntervalMs: number;
	private timer: ReturnType<typeof setInterval> | undefined;
	private active = false;
	private stopped = false;

	constructor(options: TaskRunnerOptions) {
		this.options = options;
		this.pollIntervalMs = options.pollIntervalMs ?? 3_000;
	}

	/** Recovers tasks interrupted by a previous shutdown, then starts polling. */
	async start(): Promise<void> {
		await this.recover();
		this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
		void this.tick();
	}

	async stop(): Promise<void> {
		this.stopped = true;
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	async create(input: CreateTaskInput): Promise<Task> {
		const task = await this.options.prisma.rho_sys_Task.create({
			data: { id: `task_${crypto.randomUUID()}`, ...input },
		});
		void this.tick();
		return task;
	}

	async listForConversation(conversationKey: string): Promise<Task[]> {
		return this.options.prisma.rho_sys_Task.findMany({
			where: { conversationKey },
			orderBy: { createdAt: "desc" },
		});
	}

	private async recover(): Promise<void> {
		const prisma = this.options.prisma;

		const interrupted = await prisma.rho_sys_Task.findMany({ where: { status: "running" } });
		for (const task of interrupted) {
			const attempt = task.attempt + 1;
			if (attempt < maxAttempts) {
				await prisma.rho_sys_Task.update({
					where: { id: task.id },
					data: { status: "queued", attempt, error: "interrupted by a server restart" },
				});
				continue;
			}
			await this.finish(task, { status: "failed", error: "interrupted by a server restart" });
		}

		const unnotified = await prisma.rho_sys_Task.findMany({
			where: { status: { in: ["done", "failed"] }, notifiedAt: null },
		});
		for (const task of unnotified) {
			await this.deliverOutcome(task);
		}
	}

	private async tick(): Promise<void> {
		if (this.active || this.stopped) {
			return;
		}

		this.active = true;
		try {
			while (!this.stopped) {
				const task = await this.claimNext();
				if (!task) {
					return;
				}
				await this.run(task);
			}
		} catch (error) {
			console.error("rho task runner tick failed:", error);
		} finally {
			this.active = false;
		}
	}

	private async claimNext(): Promise<Task | undefined> {
		const prisma = this.options.prisma;
		const next = await prisma.rho_sys_Task.findFirst({
			where: {
				status: "queued",
				OR: [{ runAfter: null }, { runAfter: { lte: new Date() } }],
			},
			orderBy: { createdAt: "asc" },
		});
		if (!next) {
			return undefined;
		}

		const claimed = await prisma.rho_sys_Task.update({
			where: { id: next.id },
			data: { status: "running", heartbeatAt: new Date() },
		});
		return claimed;
	}

	private async run(task: Task): Promise<void> {
		const prisma = this.options.prisma;
		const heartbeat = setInterval(() => {
			prisma.rho_sys_Task
				.update({ where: { id: task.id }, data: { heartbeatAt: new Date() } })
				.catch((error: unknown) => console.error("rho task heartbeat failed:", error));
		}, heartbeatIntervalMs);

		// Only resume from a checkpoint that was actually written to disk.
		const checkpoint = task.sessionFile && existsSync(task.sessionFile) ? task.sessionFile : undefined;
		let sessionFile = checkpoint;

		try {
			const result = await runTaskSession({
				sessionFile: checkpoint,
				sessionsDir: this.options.sessionsDir,
				cwd: this.options.cwd,
				agentDir: this.options.agentDir,
				prompt: checkpoint ? resumePrompt() : initialPrompt(task),
				agentExtensions: this.options.agentExtensions(),
				thinkingLevel: this.options.resolveTaskModel?.()?.thinkingLevel ?? this.options.taskThinkingLevel,
				model: this.options.resolveTaskModel?.()?.model ?? this.options.taskModel,
				onSession: (file) => {
					if (!file || file === sessionFile) {
						return;
					}
					sessionFile = file;
					prisma.rho_sys_Task
						.update({ where: { id: task.id }, data: { sessionFile: file } })
						.catch((error: unknown) => console.error("rho task session-file update failed:", error));
				},
			});

			await this.finish(
				{ ...task, sessionFile: result.sessionFile ?? sessionFile ?? null },
				{ status: "done", summary: result.text },
			);
		} catch (error) {
			const message = errorMessage(error);
			const attempt = task.attempt + 1;

			if (attempt < maxAttempts) {
				const backoff = retryBackoffMs[Math.min(attempt - 1, retryBackoffMs.length - 1)];
				await prisma.rho_sys_Task.update({
					where: { id: task.id },
					data: {
						status: "queued",
						attempt,
						error: message,
						runAfter: new Date(Date.now() + backoff),
					},
				});
				return;
			}

			await this.finish({ ...task, sessionFile: sessionFile ?? null }, { status: "failed", error: message });
		} finally {
			clearInterval(heartbeat);
		}
	}

	private async finish(
		task: Task,
		outcome: { status: "done" | "failed"; summary?: string; error?: string },
	): Promise<void> {
		const updated = await this.options.prisma.rho_sys_Task.update({
			where: { id: task.id },
			data: {
				status: outcome.status,
				summary: outcome.summary ?? task.summary,
				error: outcome.error ?? null,
				sessionFile: task.sessionFile,
			},
		});
		await this.deliverOutcome(updated);
	}

	private async deliverOutcome(task: Task): Promise<void> {
		const text = outcomeText(task);
		try {
			await this.options.conversations.with(task.conversationKey, () =>
				appendConversationMessage(this.options.state, task.conversationKey, {
					customType: "rho-task",
					text,
					details: { taskId: task.id, status: task.status },
				}),
			);
			await this.options.prisma.rho_sys_Task.update({
				where: { id: task.id },
				data: { notifiedAt: new Date() },
			});
		} catch (error) {
			// Leave notifiedAt unset; recovery re-delivers on the next start.
			console.error(`rho task ${task.id} outcome delivery failed:`, error);
		}
	}
}

/** Serializes async work per key. Used to keep conversation session writes ordered. */
export class KeyedMutex {
	private readonly tails = new Map<string, Promise<void>>();

	async acquire(key: string): Promise<() => void> {
		const previous = this.tails.get(key) ?? Promise.resolve();

		let release!: () => void;
		const current = new Promise<void>((resolve) => {
			release = resolve;
		});
		const tail = previous.then(() => current);
		this.tails.set(key, tail);

		await previous;
		return () => {
			release();
			if (this.tails.get(key) === tail) {
				this.tails.delete(key);
			}
		};
	}

	async with<T>(key: string, fn: () => Promise<T>): Promise<T> {
		const release = await this.acquire(key);
		try {
			return await fn();
		} finally {
			release();
		}
	}
}

function initialPrompt(task: Task): string {
	return `You are completing a background task for the user of this Rho runtime. The task was created from a chat conversation; the user sees only the final outcome message, never your work.

Task: ${task.title}

Instructions:
${task.instructions}

Work until the task is fully complete and verified. Do not end with a plan, intention, or description of what you will do next; if work remains, continue working or report a blocker. When complete, end with one final message that is sent to the user word for word: one to three friendly sentences in plain language telling them what they can now do. No file paths, no technical terms, no work summary, no verification report — just the outcome.`;
}

function resumePrompt(): string {
	return `You were interrupted while working on this task. Review the session so far, verify what has already been done, and continue until the task is fully complete. End with the final user-facing outcome message as originally instructed.`;
}

function outcomeText(task: Task): string {
	if (task.status === "done") {
		return task.summary?.trim() || `I finished: ${task.title}.`;
	}

	const reason = task.error ? ` (${truncate(task.error, 200)})` : "";
	return `I couldn't finish "${task.title}"${reason}. I've stopped for now — tell me if you'd like me to try again.`;
}

function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
