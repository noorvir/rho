# Current Work: Extension notification backend

## Goal

Let extensions declare notification capabilities and emit notifications. Keep notifications independent from cron scheduling.

The UI mock is done; this plan is backend/runtime only.

## Boundaries

- **Notifications** own definitions and emitted notification rows.
- **Crons** own scheduling only. A cron is a scheduled task (runs code) or a reminder (wakes the agent). Cron rows do not store notification metadata.
- If scheduled code wants to notify, it emits a notification from its handler. If the agent wants to notify, it calls the notification tool. Cron does not know about notifications beyond exposing `ctx.notifications.emit(...)` to handlers.

## Notification definition

Extensions register stable notification capabilities:

```ts
rho.notificationDef({
  id: "plant-care",
  title: "Plant care",
  prompt: "Use this for plant care alerts, such as watering, fertilizing, or repotting.",
});
```

The definition is a permission/configuration handle, not the final notification. Runtime/user policy can enable or disable it. Concrete content is supplied at emit time:

```ts
await rho.notifications.emit({
  def: "plant-care",
  title: `Water ${plant.name}`,
  body: `${plant.name} is due for watering today.`,
  level: "attention",
  idempotencyKey: `water:${plant.id}:${occurrence}`,
  target: { type: "plant", id: plant.id },
});
```

`emit` is create-once on `(defKey, idempotencyKey)`.

## Cron handler emit

Scheduled-task cron handlers receive `ctx.notifications.emit(...)`. Example flow:

```ts
rho.cron({
  id: "plant-book.water-check",
  title: "Plant watering check",
  schedule,
  enabled: true,
  run: async (ctx) => {
    const due = await ctx.db.plant.findMany(/* due for watering */);
    for (const plant of due) {
      await ctx.notifications.emit({
        def: "plant-care",
        title: `Water ${plant.name}`,
        body: `${plant.name} is due for watering today.`,
        level: "attention",
        idempotencyKey: `water:${plant.id}:${ctx.cron.nextRunAt.toISOString()}`,
        target: { type: "plant", id: plant.id },
      });
    }
  },
});
```

## Agent tool

One global `rho_notification_send` tool. Registered definitions are injected into its prompt/context as allowed `defKey` values; the tool validates the definition exists and is enabled at runtime.

## Storage

`rho_sys_` tables for notification definitions and emitted notifications. No notification fields on cron rows.

## Read path

`GET /agent/notifications` returns current (non-dismissed) notifications for Home/mobile.

## End-to-end test target

Plant Book-style extension:

1. registers `notificationDef({ id: "plant-care" })`
2. a scheduled cron handler (or the agent) emits `plant-care`
3. one notification row is created
4. emitting the same occurrence again does not duplicate

## Next steps

- Wire mobile Home notifications preview to `GET /agent/notifications`.
- Add user enable/disable of notification defs in Settings.
- Add dismiss/read endpoints when the UI needs them.
