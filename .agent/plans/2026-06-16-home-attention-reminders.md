# Current Work: Home attention and reminders

## Goals

Shape Rho's mobile Home screen around two separate concepts:

1. **Notifications / attention items**: things an extension or agent wants to bring to the user's attention now. Example: an email triage extension finds an email that looks important and surfaces it near the top of Home.
2. **Reminders**: scheduled reminders or scheduled agent work the user asked Rho to handle. These come from agent-created crons and should feel calmer and more predictable than attention notifications.

The immediate work is still UI mock iteration in SwiftUI. Do not implement the runtime API, database shape, extension registration, or notification delivery mechanics until the UI direction is clearer.

## Current direction

Home should show notifications before reminders when there is something new or important. If there are no new notifications, the notifications area should collapse or become very small so the screen does not feel noisy.

Reminders should have their own section. They can be backed by agent-created crons later, but visually they should not be mixed with extension attention notifications.

Avoid notification fatigue:

- Notifications should be explicitly registered/configurable by extensions.
- Extensions should not get a generic right to put arbitrary cards at the top of Home without declaring the type of attention item they can emit.
- The user should be able to control which extension notification types appear on Home and how prominently.
- Repeated or stale notification items should be grouped, collapsed, or de-emphasized.

## Future runtime shape to explore

Extension definitions may register notification types, similar in spirit to the earlier widget-registration idea.

Example only:

```ts
rho.notificationType({
  id: "important-email",
  title: "Important email",
  description: "Email triage items that probably need your attention.",
  defaultPlacement: "home",
});
```

The extension can then emit instances of that registered type. Rho owns the user-facing policy: enabled/disabled state, grouping, prominence, stale-item handling, and Home placement.

Extension crons may deserve the same explicit registration treatment as notifications: stable ids and declared purpose in extension code, with user configuration layered on top. This should be reconciled with the existing cron scheduler plan before implementation.

## Non-goals for the current UI pass

- Do not build notification APIs yet.
- Do not build extension registration yet.
- Do not build real reminder persistence in this pass.
- Do not mirror iOS widgets inside the app.
- Do not use stacked cards if they make the Home screen look heavier or less readable.

## Immediate UI next step

Replace the stacked Today card mock with two clear sections:

- **Notifications**: top section for extension/agent attention items, possibly a single important example card and a quiet empty/collapsed state later.
- **Reminders**: separate section for scheduled reminders, using simpler list/card rows.

Keep the header near the top and continue rapid phone-build iteration based on screenshots and feedback.
