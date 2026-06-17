# Current Work: Cron scheduler for Rho

## Goals

Add a small, reliable cron capability to Rho so the runtime can schedule work that survives reloads and restarts.

Rho needs two cron kinds:

1. **Crons**: extension code registers a stable cron id and a function to run. The database keeps durable schedule/state for that id; the callable function comes from currently loaded code, not from a stored function name.
2. **Agent crons**: the user asks the agent to remind them or do scheduled work later. The cron stores agent instructions and wakes the agent at the scheduled time.

Both kinds share the same scheduler, schedule model, timezone handling, listing, enable/disable, and run-state tracking.

## Non-goals

- Do not build the Gmail app in this work. Gmail may be used only as an example of a cron.
- Do not add a second background-task runner. Reuse the existing task system for agent crons.
- Do not make extension crons depend on a stored handler/function name. Extension functions are registered from code on load.
- Do not implement implicit “suggested crons” or commitment inference.
- Do not add distributed/multi-process locking in the first cut. Rho is a personal long-running server; one runtime process is the target.
- Do not add optional-field-heavy APIs. Required fields should be required unless absence is a real state.

## Current Direction

Use a DB-backed cron registry plus an in-process scheduler in the long-running Rho server.

Use a normal cron dependency, likely `croner`, for cron expression parsing, next-run calculation, timezone behavior, and in-process timing support. Rho still persists cron rows/state in SQLite because the runtime must list, update, enable/disable, and recover crons after reloads/restarts. The dependency is a calculator/timer primitive, not the source of truth.

### Schedule shape

At the TypeScript boundary, model schedules as a discriminated union:

```ts
type CronSchedule =
  | { kind: "at"; at: Date; timezone: string }
  | { kind: "cron"; expression: string; timezone: string };
```

Keep the first cut to one-shot `at` schedules and recurring calendar `cron` schedules. Human requests like “every 5 minutes” can become cron expressions when calendar semantics are acceptable. Add a true anchored interval schedule later only if Rho needs “every N milliseconds from this exact anchor” semantics that cron cannot express cleanly.

`timezone` is always concrete. If the user did not explicitly specify one, Rho resolves the user's default timezone before constructing/storing the cron. The stored cron never has an absent timezone.

For the user's default timezone, use a runtime-owned value. If Rho does not already have one, add the smallest owner/runtime setting needed and initialize it from the browser timezone when available, with server-local timezone as a fallback for terminal/dev usage. Existing homes must get a concrete value during migration.

### Storage shape

Use system tables owned by core migrations, not `rho_migrate`.

Use one cron table. Agent-only fields and extension-owned fields are concrete strings that default to empty, so the live shape avoids nullable state while staying simple:

```prisma
enum rho_sys_CronKind {
  extension
  agent
}

enum rho_sys_CronScheduleKind {
  at
  cron
}

enum rho_sys_CronStatus {
  not_run
  running
  succeeded
  failed
}

enum rho_sys_CronPurpose {
  REMINDER       @map("reminder")
  SCHEDULED_TASK @map("scheduled_task")
}

model rho_sys_Cron {
  id              String                   @id
  kind            rho_sys_CronKind
  title           String
  scheduleKind    rho_sys_CronScheduleKind @map("schedule_kind")
  schedule        String                   // ISO date or cron expression
  timezone        String
  enabled         Boolean                  @default(true)
  status          rho_sys_CronStatus       @default(not_run)
  nextRunAt       DateTime                 @map("next_run_at")
  lastRunAt       DateTime?                @map("last_run_at")
  lastError       String?                  @map("last_error")
  activeRunId     String?                  @map("active_run_id")
  purpose         rho_sys_CronPurpose
  instructions    String?
  conversationKey String?                  @map("conversation_key")
  channelId       String?                  @map("channel_id")
  targetType      String?                  @map("target_type")
  targetId        String?                  @map("target_id")
  extensionId     String?                  @map("extension_id")
  createdAt       DateTime                 @default(now()) @map("created_at")
  updatedAt       DateTime                 @updatedAt @map("updated_at")

  @@index([nextRunAt])
  @@index([extensionId])
  @@map("rho_sys_crons")
}
```

`lastRunAt` is nullable because “never ran” has no honest timestamp. The live state does not rely on nullable status; it uses `status = not_run`.

`activeRunId` is null when nothing is active. For an agent cron it can hold the spawned task id; for a cron it can hold an internal run id. Kind-specific fields are nullable because they are genuinely absent for the other cron kind. `purpose` is required for every cron: `REMINDER` for user-visible reminders/alarms, `SCHEDULED_TASK` for extension jobs and scheduled agent work. Prisma maps those enum members to lowercase stored values.

### Cron API

Extensions register crons from code. The registration includes a stable id and a function reference. The function reference lives only in memory after extension load.

Example only:

```ts
export default defineExtension(async (rho) => {
  rho.cron({
    id: "example.ingest-and-triage",
    title: "Example ingest and triage",
    schedule: {
      kind: "cron",
      expression: "*/5 * * * *",
      timezone: rho.user.timezone,
    },
    enabled: true,
    run: async (ctx) => {
      await ctx.db.exampleSync();
      await ctx.agent.run("Triage newly synced items.");
    },
  });

  return { apps: [] };
});
```

The important behavior is the identity and binding:

```ts
type CronRegistration = {
  id: string;
  title: string;
  schedule: CronSchedule;
  enabled: boolean;
  run: (ctx: CronContext) => Promise<void>;
};

class CronRegistry {
  register(input: CronRegistration) {
    this.extensionRuns.set(input.id, input.run);
    this.reconcileCron(input);
  }
}
```

On extension reload:

- Same id means update title/schedule/default enabled/function binding without duplicating the cron.
- User-managed `enabled` state is preserved unless the extension explicitly changes policy later.
- If a previously registered cron is no longer registered by the extension, disable it and record a clear error instead of continuing to call stale code.
- The DB never stores `run`, `handlerKey`, or a function name. Due crons run only if their id is currently registered in memory.

### Agent cron API

Agent-created crons are data. The agent supplies complete fields; Rho generates the id and returns it.

```ts
rho_cron_create({
  title: string,
  schedule: CronSchedule,
  enabled: boolean,
  purpose: "reminder" | "scheduled_task",
  instructions: string,
}) -> { id: string }

rho_cron_update({
  id: string,
  title?: string,
  schedule?: CronSchedule,
  enabled?: boolean,
  purpose?: "reminder" | "scheduled_task",
  instructions?: string,
}) -> { id: string }

rho_crons({
  scope: "all" | "agent" | "extension",
}) -> { crons: CronSummary[] }
```

No create input id. Updates are partial: callers list/read first, then send the id plus only the fields that should change. An update with only an id is rejected as a no-op. Cron definitions are code-owned, so `rho_cron_update` can only change `enabled` for crons.

Example only:

```ts
rho_cron_create({
  title: "Message Sophie reminder",
  schedule: {
    kind: "at",
    at: new Date("2026-06-15T18:05:00-07:00"),
    timezone: "America/Los_Angeles",
  },
  enabled: true,
  purpose: "reminder",
  instructions: "Remind the user to message Sophie.",
});
```

When an agent cron fires, the scheduler creates a normal background task with the stored instructions and delivery target. Task retries, crash recovery, and conversation delivery stay owned by the existing task runner.

### Scheduler pseudocode

Keep the scheduler direct and small. Croner owns live timers; SQLite owns durable definitions and run state:

```ts
class CronScheduler {
  private jobs = new Map<string, Cron>();

  async start() {
    await this.recoverInterruptedRuns();
    await this.rescheduleCrons();
  }

  async replaceCrons(registrations: CronRegistration[]) {
    await this.reconcileExtensionRows(registrations);
    this.replaceRegisteredRuns(registrations);
    await this.rescheduleCrons();
  }

  private async rescheduleCrons() {
    this.stopJobs();

    const crons = await this.db.cron.findMany({ where: { enabled: true } });
    for (const cron of crons) {
      const pattern = cron.scheduleKind === "at" ? new Date(cron.schedule) : cron.schedule;
      this.jobs.set(cron.id, new Cron(pattern, { timezone: cron.timezone }, () => this.fireCronById(cron.id)));
    }
  }

  private async fireCronById(id: string) {
    const cron = await this.loadCron(id);
    if (!cron?.enabled) {
      this.stopJob(id);
      return;
    }

    await this.fireCron(cron, new Date());
    if (cron.scheduleKind === "at") {
      this.stopJob(id);
    }
  }

  private async fireCron(cron: CronRow, now: Date) {
    if (cron.activeRunId) {
      const stillRunning = await this.isRunStillActive(cron);
      if (stillRunning) {
        await this.advanceAfterSkippedOverlap(cron, now);
        return;
      }
    }

    const nextRunAt = this.nextRunAfter(cron.schedule, now);
    const runId = createId();

    await this.markRunning({ cron, runId, nextRunAt, now });

    if (cron.kind === "extension") {
      await this.runRegisteredCron(cron, runId);
      return;
    }

    await this.enqueueAgentCron(cron, runId);
  }
}
```

The scheduler advances recurring `nextRunAt` before executing the run, so a crash does not repeatedly fire the same recurring slot. One-shot `at` crons are disabled after a successful run.

### Next-run and missed-run rules

```ts
function nextRunAfter(schedule: CronSchedule, after: Date): Date {
  if (schedule.kind === "at") {
    return schedule.at;
  }

  return cronerNextRun(schedule.expression, schedule.timezone, after);
}
```

Reliability rules:

- Persist `nextRunAt`; do not rely on in-memory timers as truth.
- Use the cron dependency to compute next dates; do not hand-roll cron expression math.
- Coalesce missed recurring runs. If Rho was down through many scheduled slots, run once when it wakes, then jump to the next future slot.
- Do not stack runs. If a previous run is still active, skip that slot and advance.
- Do not silently disable recurring crons because of a runtime error. Mark `status = failed`, keep the row visible, and store `lastError`.
- One-shot agent reminders disable themselves after success.
- Crons with missing loaded code fail visibly instead of calling a stale stored function name.

## Implementation notes from AGENTS.md

- Start outside-in: define the extension registration API and agent tool shapes first, then implement storage/scheduler internals to support those call sites.
- Keep this small. Do not add plugin managers, broad policy layers, suggestion systems, or a second task runner.
- Use Prisma schema/generated client as the source of truth for system tables. Do not add DTO mirrors of Prisma models unless a boundary needs a different shape.
- System-table changes are core-authored migrations. Do not use `rho_migrate` for `rho_sys_*` changes.
- Do not read raw env vars from core cron code. Timezone defaults must come from runtime-owned settings/options, not scattered `process.env` reads.
- Avoid `any`, type assertions, non-null assertions, and optional-field soup. Validate at the API boundary, then operate on clean required shapes.
- Keep helper names calm and direct. Prefer `getNextRun`, `createAgentCron`, `registerCron` over factory/manager names unless the abstraction pays for itself.
- Await service calls into named variables before composing return values in HTTP/tool boundaries.
- Preserve unrelated dirty work and Git index state.

## Success Criteria

- [x] Core has DB-backed cron rows with required timezone and non-null live status.
- [x] Crons can be registered from extension code with a stable id and in-memory function binding.
- [x] Re-registering the same cron after reload updates/rebinds it without duplicating it.
- [x] Agent can create a scheduled reminder cron and gets back a generated id.
- [x] Agent can list crons and enable/disable them through partial update.
- [x] Due crons run their currently registered function.
- [x] Due agent crons enqueue normal background tasks with stored instructions.
- [x] Missed recurring runs coalesce instead of replaying every missed scheduled slot.
- [x] One-shot reminders disable after successful execution.
- [x] Missing extension code fails visibly and does not call stale stored names.

## Tests / Validation

- Unit-test schedule parsing and next-run behavior for `at` and cron expression schedules, including timezone validation.
- Unit-test missed-run coalescing: many missed scheduled slots produce one run and the next future `nextRunAt`.
- Unit-test overlap behavior: a cron with an active run does not enqueue/start a second run.
- Integration-test agent cron firing through `TaskRunner.create` into a temp SQLite runtime.
- Integration-test extension registration: same id across reload updates the existing row and binds the new function.
- Integration-test stale extension registration: missing code disables or fails visibly according to the final chosen reconcile rule.
- Run focused typecheck/LSP diagnostics on changed TypeScript files.

## Progress

- [x] Research compared OpenClaw, Hermes, NanoClaw, and current Rho task/runtime architecture.
- [x] User clarified the two cron kinds: extension code-defined crons and agent-created instruction crons.
- [x] User clarified data-shape preferences: concrete timezone, concrete live status, generated ids for agent-created crons; later accepted partial update for agent cron changes.
- [x] Validation passed: typecheck; cron e2e; HTTP `/agent/crons` e2e; HTTP chat agent created a 30-second reminder cron and the scheduled task delivered the reminder.
- [x] Implement core schema and migration.
- [x] Implement schedule parsing/next-run calculation using a cron dependency.
- [x] Implement extension registration API.
- [x] Implement scheduler loop and recovery.
- [x] Implement agent cron tools.
- [x] Add docs and focused validation.
