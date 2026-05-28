# Current Work: Channel Streaming and Pi-backed Agent Interface

## Goal

Build the local rho server path around two clean boundaries:

1. **Channels** own transport/client-visible message delivery. They use rho `ChannelMessage` shapes, support streaming as `AsyncIterable<ChannelMessage>`, and model media/realtime transport at the channel layer.
2. **AI/runtime** owns conversion between channel messages and Pi agent inputs/events. Reuse Pi types for messages, content, tool calls, and agent-loop streaming wherever possible instead of duplicating an agent vocabulary.

The first shippable path is HTTP mobile chat -> rho server -> rho AI agent -> streamed HTTP response. The backing agent can remain fake/echo temporarily, but the interface should match the Pi-shaped agent boundary so replacing it with a real Pi agent is straightforward.

## Current State

The repository has a Hono `@rho/server`, a persistent built-in `HttpChannel`, `/health`, `/reload`, and `POST /channels/http/messages`. The mobile app can call the endpoint and render an echo response.

The channel data model has been reset around:

- `Channel`
- `RealtimeChannel`
- `RealtimeSession`
- `ChannelMessage`
- `ChannelMessageStream = AsyncIterable<ChannelMessage>`
- `ChannelOutput = ChannelMessage | ChannelMessageStream`
- `ChannelTarget`
- content parts for text, image, audio, video, and files

The current server still uses a fake echo path. Mobile still needs true incremental SSE parsing/rendering.

## Channel Boundary

Channels are transport adapters. External systems do not call `receive` directly on a channel. A channel listens to its platform or receives an HTTP/webhook request, normalizes that input into a `ChannelMessage`, and passes it to the runtime through the injected channel context.

Outbound delivery is the inverse: the runtime gives the channel either one `ChannelMessage` or an async stream of `ChannelMessage`s. The channel renders those messages to its platform: SSE chunks for HTTP, edits/drafts for chat platforms, final-only messages for transports without streaming.

`ChannelTarget` is the channel routing address. It is intentionally not a Pi concept.

Realtime audio/video remains a separate channel capability. It should not be forced through normal chat message send/receive.

## AI Boundary

The rho AI interface should be Pi-shaped and reuse Pi types:

- Pi `AgentMessage` for durable AI conversation messages.
- Pi `AgentEvent` for streaming agent-loop events.
- Pi `TextContent` and `ImageContent` directly where supported.
- Rho adds only missing media content shapes when Pi has no equivalent, and those should be converted at the channel/runtime boundary before calling Pi.

Do not introduce `AgentRun` yet. A persistent/cancellable run resource can be added later when cancellation, persistence, or multi-turn active-run inspection require it. For now, the streaming execution can be represented by an async iterable returned from the agent interface.

### Pi Interface Notes

Pi has two useful layers:

1. `@earendil-works/pi-ai` is the provider/message layer.
   - `Message = UserMessage | AssistantMessage | ToolResultMessage`.
   - User content is `string | (TextContent | ImageContent)[]`.
   - Assistant content is `(TextContent | ThinkingContent | ToolCall)[]`.
   - Tool results use `(TextContent | ImageContent)[]` plus `details` and `isError`.
   - Provider streaming emits `AssistantMessageEvent` with `text_delta`, thinking deltas, tool-call deltas, and terminal `done` / `error`.
   - `AssistantMessageEventStream` is an `EventStream<AssistantMessageEvent, AssistantMessage>` and exposes `result()` for the final assistant message.

2. `@earendil-works/pi-agent-core` is the agent-loop layer.
   - `AgentMessage` is Pi `Message` plus app-extendable custom messages through declaration merging.
   - The `Agent` class owns state, tools, queues, aborting, and event subscribers.
   - `agent.prompt(...)` returns `Promise<void>`; streaming is observed through `agent.subscribe((event, signal) => ...)`.
   - Low-level `agentLoop(...)` returns an `EventStream<AgentEvent, AgentMessage[]>` and can be iterated directly.
   - `AgentEvent` includes user/assistant/tool-result message lifecycle, assistant `message_update` events with the underlying `AssistantMessageEvent`, tool execution start/update/end, turn boundaries, and final `agent_end` with messages.
   - `Agent.subscribe()` listeners are awaited in order and are part of run settlement. `agent_end` is final, but the agent is not idle until awaited listeners finish.
   - `Agent.abort()` and the active abort signal are the current cancellation primitive.

Implications for rho:

- Rho should not invent text/tool/thinking event types at the AI boundary.
- The initial `rho/ai` interface can wrap Pi by returning `AsyncIterable<AgentEvent>` plus final `AgentMessage[]` semantics, or by exposing a callback/subscription shape similar to Pi `Agent.subscribe()`.
- If using the Pi `Agent` class directly, rho must bridge callback-style events into an async iterable for channel streaming.
- If using low-level `agentLoop`, rho gets an async iterable naturally, but loses the `Agent` class barrier semantics and queue/state conveniences unless it rebuilds them.
- The first clean interface should preserve Pi's event stream and leave channel rendering to a separate mapper from `AgentEvent` to `ChannelMessage` chunks.

## Server Shape

The server owns HTTP routing, request-local SSE streams, reload/lifecycle wiring, and conversion between HTTP request bodies and channel messages.

The runtime owns channel dispatch. The request handler should not create a runtime. It should only create request-local stream state, attach it to the HTTP channel, create a `ChannelMessage`, and hand that message to the runtime.

## HTTP Contract Direction

Current HTTP streaming can remain message-level while the AI boundary settles:

```txt
POST /channels/http/messages
  -> validates JSON
  -> creates request-local SSE stream
  -> attaches stream to HttpChannel
  -> creates ChannelMessage
  -> ChannelRuntime.receive(message)
  -> AI handler returns ChannelMessage or AsyncIterable<ChannelMessage>
  -> HttpChannel renders each message as SSE events
```

Near-term SSE events should reflect channel message streaming, not a premature run model. If later clients need Pi event details, the server/runtime can map Pi `AgentEvent`s into channel message chunks or explicit debug/progress channel content.

## Implementation Plan

1. **Channel model cleanup**
   - Keep `ChannelMessage` as the client/transport-visible shape.
   - Keep streaming as `AsyncIterable<ChannelMessage>`.
   - Keep media/realtime shapes minimal and transport-owned.
   - Avoid duplicate inbound/outbound/run/event types in the channel package.

2. **Rho AI interface**
   - Replace the current text-only `AgentInput` / `AgentReply` with a Pi-shaped interface.
   - Reuse Pi `AgentMessage`, `AgentEvent`, `TextContent`, `ImageContent`, and related message content types where possible.
   - Support both final responses and streaming responses through async iterables.
   - Keep the implementation thin: initially an echo/faux Pi-backed agent is fine.

3. **Channel-to-AI marshalling**
   - Convert inbound `ChannelMessage` content into Pi-compatible `AgentMessage`s.
   - Convert Pi final/streaming output into outbound `ChannelMessage`s for the originating channel/target.
   - Keep unsupported media conversion explicit at the boundary.

4. **HTTP channel streaming**
   - Have the server handler call the backing rho agent through the runtime path.
   - Return streamed channel messages from the handler path so `HttpChannel` emits SSE incrementally.
   - Preserve the built-in default HTTP channel and reload behavior.

5. **Mobile streaming**
   - Change mobile from response-completion parsing to incremental SSE consumption.
   - Render text chunks as they arrive.
   - Keep UI compact and safe-area-aware.

## Non-goals

- Auth, persistence, user accounts, production deployment, external tunnels, or push notifications.
- Durable conversation storage or message history sync.
- Full realtime audio/video implementation in this pass.
- Full daemon/supervisor implementation in this pass.
- Filesystem watching or automatic reload in this pass.
- A rho-specific duplicate of Pi's agent event/type model.

## Design Constraints

- Channels own platform mechanics and client-visible delivery shapes.
- Server owns HTTP/SSE routing, lifecycle, reload, and dependency wiring.
- AI/runtime owns Pi integration and conversion between channel messages and Pi messages/events.
- Prefer Pi types over rho duplicates at the AI boundary.
- Keep interfaces tight: no optional fields unless absence is a real state.
- Avoid global singletons where injected dependencies keep the same code testable and reloadable.

## Validation

- `bun run check` passes.
- Starting the server exposes `/health` and the HTTP message endpoint.
- A command-line HTTP request receives SSE frames incrementally.
- The iOS app can send chat text and display text deltas incrementally.
- SwiftUI app builds, installs, launches, and is visually inspected after chat wiring.

## Progress

- [x] Defined channel-first API shape.
- [x] Implemented first CLI echo path.
- [x] Moved CLI wiring into `@rho/cli` so `@rho/ai` stays standalone.
- [x] Added Hono server package/entrypoint.
- [x] Implemented persistent default HTTP channel.
- [x] Added message-level streaming shape with `AsyncIterable<ChannelMessage>`.
- [x] Sketched basic media and realtime channel types.
- [ ] Replace text-only `rho/ai` agent interface with Pi-shaped message/event interface.
- [ ] Stream agent output through `HttpChannel` as channel message chunks.
- [ ] Render streamed SSE chunks incrementally in mobile.
- [ ] Validate server and mobile streaming end to end.
