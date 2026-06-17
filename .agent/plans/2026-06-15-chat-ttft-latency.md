# Chat time-to-first-token latency

## Intent
Make the Rho chat feel real-time: the user's first visible reply should arrive
in ~1s, and "build me an app" should acknowledge instantly and then build in the
background (~1–2 min). Keep changes minimal; do not re-engineer the pi/session
machinery.

## What was measured (local, HTTP `/agent/messages:stream`, codex/anthropic auth)
- Session machinery per message (`SettingsManager.reload` + `DefaultResourceLoader.reload`
  + `createAgentSession` + `bindExtensions`): **~3 ms** in a production-shaped
  (minimal) agent dir. It is NOT the bottleneck. The "pi reloads every message"
  hypothesis is disproven for the channel agent dir.
- Simple question TTFT: ~1.2–2.5 s, dominated by provider (LLM) first-token
  latency and network; high run-to-run variance.
- The real slow case is "do something" requests. With the original prompt the
  channel agent emitted the `background_task` tool call FIRST and only replied
  AFTER the tool round-trip, so the user saw nothing until a full
  reason→tool→reason cycle finished. With medium thinking this compounds into
  the reported 10–15 s.

Clean A/B (same model gpt-5.5, channel minimal thinking, only prompt ordering
changed), "build me an expense tracker":
- tool-first (original): ~4.6–7.4 s to first visible text
- ack-first (new): ~1.4–2.5 s to first visible text

Model choice is noisy and not a robust lever: claude-haiku is sometimes faster
for plain chat but SLOWER for the tool/build flow (it does not honor
text-before-tool ordering as well). So we do not force a specific channel model.

End-to-end build of a real app (single request) runs in ~2 min. The long queue
seen while benchmarking was an artifact of firing many build requests at the
serial task runner, not a per-build delay.

## Changes (minimal, config-driven)
1. Channel system prompt: acknowledge in text FIRST, then call `background_task`
   in the same turn (ack-first). This is the main, model-agnostic win.
2. Channel turns default to `minimal` thinking (orchestration/transcription
   role; heavy reasoning stays in the background task at medium).
3. New optional config knobs mirroring the existing task knobs:
   `RHO_CHANNEL_MODEL` (provider/modelId) and `RHO_CHANNEL_THINKING_LEVEL`,
   threaded as `channelModel` / `channelThinkingLevel` core options. Default:
   settings model, minimal thinking. No vendor hardcoded in core.

## Not done / deferred
- No session caching/reuse: machinery is ~3 ms, so it would add complexity for
  no measurable gain.
- Provider first-token latency (~1 s floor) is the remaining wall; only a
  faster/closer model or prompt caching would push below it.
- The post-tool "second message" some models add after the ack is cosmetic;
  the prompt discourages it but small models may still add a brief line.
