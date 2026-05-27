# Channel and Streaming Architecture Research

## Scope

Compared four agent/coding-harness style systems: OpenClaw, Hermes Agent, ZeroClaw, and Nanobot. The research focused on channel structure, streaming, authentication, cancellation/interruption, media uploads, images, and voice.

## Executive Summary

The mature systems converge on the same shape:

1. **Ingress adapters normalize external platforms into one internal message shape.** Telegram, WhatsApp, webhooks, HTTP chat, CLI, and web chat should not each call the agent differently.
2. **Streaming is semantic events, not raw provider chunks.** Channels map events to native behavior: SSE/WebSocket chunks, Telegram edit-in-place, Discord multi-message updates, WhatsApp final-only, etc.
3. **Authentication has two layers.** Platform credentials get a connector online; per-sender authorization gates who may invoke the agent.
4. **Cancellation is turn/session scoped.** Stop, disconnect, new-message interrupt, and shutdown should flow through one cancellation path with a reason.
5. **Media must be normalized at ingress.** Store uploads or downloaded platform media as durable handles/local files, then pass typed metadata to the agent/provider layer.
6. **Voice is not just another text channel.** Voice input can become a normal message with transcript/audio attachment metadata, but realtime duplex voice requires sessions, VAD/barge-in, TTS queues, and WebSocket/audio stream control.

For rho: keep the public interfaces small, typed, and host-owned. Build extension points that let others add channels without giving each channel control over runtime policy.

## System Comparisons

| System | Core Shape | Streaming | Auth | Cancellation | Media / Voice |
|---|---|---|---|---|---|
| OpenClaw | Gateway prepares a turn; channels/harnesses receive prepared callbacks and delivery hooks. | Callback/event stream; live previews and finalization, not raw provider stream. | Provider auth profiles + channel allowlists/pairing/scopes. | Registered abort controllers before ack; propagated to harness/tools. | Claim-check media store; inline images when supported; realtime voice plugins. |
| Hermes Agent | Gateway adapters normalize to sessions and `AIAgent`; stream consumer bridges sync callbacks to async delivery. | Queue-backed stream consumer, edit/draft transports, tool-boundary segments. | Allowlist + DM pairing + command tiers. | Agent interrupt flags + tool/thread interruption + gateway stop reasons. | URL/cache safety, media root validation, TTS/voice methods on adapters. |
| ZeroClaw | Rust traits for channels; channel orchestrator dispatches messages and draft events. | Draft lifecycle: send/update/finalize/cancel. | Per-channel allowlists/pairing/signature checks. | Cancellation token and `session/cancel` semantics. | Marker-based media pipeline, centralized provider multimodal preparation. |
| Nanobot | Minimal async message bus + per-channel adapters; WhatsApp bridge is separate Node process. | Metadata-driven stream deltas routed by ChannelManager. | Platform credentials separate from `allowFrom`/pairing. | Session-keyed `/stop`, task cancellation, mid-turn injection queue. | Inbound media becomes local paths; WhatsApp bridge hardens local WS auth. |

## Evidence Highlights

### OpenClaw

OpenClaw separates gateway/channel policy from harness execution. The channel message layer has explicit durability, receipts, preview/live message phases, and media/voice part kinds. See `MessageReceiptPartKind`, `LiveMessageState`, and send contexts in [`src/channels/message/types.ts`](https://github.com/openclaw/openclaw/blob/c59635ae970cb70171c72fa422b15dc38319414f/src/channels/message/types.ts#L43-L166).

OpenClaw's live preview finalizer is a strong example of semantic streaming: preview, edit/finalize-in-place, fallback delivery, and cancellation are managed above platform specifics in [`src/channels/message/live.ts`](https://github.com/openclaw/openclaw/blob/c59635ae970cb70171c72fa422b15dc38319414f/src/channels/message/live.ts#L1-L150).

Telegram streaming is implemented as a draft message that is sent/edited/finalized with throttling and message-id state in [`extensions/telegram/src/draft-stream.ts`](https://github.com/openclaw/openclaw/blob/c59635ae970cb70171c72fa422b15dc38319414f/extensions/telegram/src/draft-stream.ts#L75-L180).

WhatsApp keeps auth state separate from message routing, stores web creds on disk, detects unstable auth, and can restore backups; see [`extensions/whatsapp/src/auth-store.ts`](https://github.com/openclaw/openclaw/blob/c59635ae970cb70171c72fa422b15dc38319414f/extensions/whatsapp/src/auth-store.ts#L27-L180). WhatsApp media downloads are normalized through a media store with MIME detection and size limits in [`extensions/whatsapp/src/inbound/media.ts`](https://github.com/openclaw/openclaw/blob/c59635ae970cb70171c72fa422b15dc38319414f/extensions/whatsapp/src/inbound/media.ts#L51-L100).

Voice is modeled as realtime sessions and callbacks, not as a plain chat message. The Twilio media stream handler receives audio by WebSocket, forwards STT, queues TTS, and handles barge-in/cancel state in [`extensions/voice-call/src/media-stream.ts`](https://github.com/openclaw/openclaw/blob/c59635ae970cb70171c72fa422b15dc38319414f/extensions/voice-call/src/media-stream.ts#L1-L180).

### Hermes Agent

Hermes uses a platform adapter base class and a gateway stream consumer. The stream consumer explicitly says the agent calls `stream_delta_callback(text)` synchronously from a worker thread, and the consumer bridges that into async platform delivery in [`gateway/stream_consumer.py`](https://github.com/NousResearch/hermes-agent/blob/2c6bbaf3529fbd7dca4330d53b5c819f3d223ba5/gateway/stream_consumer.py#L1-L120).

Hermes adapters include media cache and safe outbound delivery helpers. URL/media handling and delivery root checks live in [`gateway/platforms/base.py`](https://github.com/NousResearch/hermes-agent/blob/2c6bbaf3529fbd7dca4330d53b5c819f3d223ba5/gateway/platforms/base.py#L613-L1005). Voice methods like `send_voice` are adapter capabilities rather than separate agent logic in [`gateway/platforms/base.py`](https://github.com/NousResearch/hermes-agent/blob/2c6bbaf3529fbd7dca4330d53b5c819f3d223ba5/gateway/platforms/base.py#L2243-L2373).

The agent accepts `stream_delta_callback` and exposes `interrupt()` for cooperative stop propagation in [`run_agent.py`](https://github.com/NousResearch/hermes-agent/blob/2c6bbaf3529fbd7dca4330d53b5c819f3d223ba5/run_agent.py#L386-L455) and [`run_agent.py`](https://github.com/NousResearch/hermes-agent/blob/2c6bbaf3529fbd7dca4330d53b5c819f3d223ba5/run_agent.py#L1728-L1745).

Gateway authorization includes allowlists, pairing store, and command access policy in [`gateway/run.py`](https://github.com/NousResearch/hermes-agent/blob/2c6bbaf3529fbd7dca4330d53b5c819f3d223ba5/gateway/run.py#L6377-L6791).

### ZeroClaw

ZeroClaw exposes a direct channel trait. Its `Channel` trait includes `send`, `listen`, health checks, typing indicators, draft update hooks, and reactions in [`crates/zeroclaw-api/src/channel.rs`](https://github.com/zeroclaw-labs/zeroclaw/blob/d47b5aade3cdbf39c853d06f4af01c4e26eb4994/crates/zeroclaw-api/src/channel.rs#L149-L289). `ChannelMessage` and `SendMessage` define the internal inbound/outbound message shapes in the same file: [`crates/zeroclaw-api/src/channel.rs`](https://github.com/zeroclaw-labs/zeroclaw/blob/d47b5aade3cdbf39c853d06f4af01c4e26eb4994/crates/zeroclaw-api/src/channel.rs#L35-L96).

The channel orchestrator checks whether a channel supports drafts, sends a draft, updates progress/content, cancels on errors, and finalizes the draft in [`crates/zeroclaw-channels/src/orchestrator/mod.rs`](https://github.com/zeroclaw-labs/zeroclaw/blob/d47b5aade3cdbf39c853d06f4af01c4e26eb4994/crates/zeroclaw-channels/src/orchestrator/mod.rs#L3697-L4325).

Telegram implements the draft lifecycle directly in [`crates/zeroclaw-channels/src/telegram.rs`](https://github.com/zeroclaw-labs/zeroclaw/blob/d47b5aade3cdbf39c853d06f4af01c4e26eb4994/crates/zeroclaw-channels/src/telegram.rs#L2935-L3249). Discord has similar stream mode and draft handling in [`crates/zeroclaw-channels/src/discord.rs`](https://github.com/zeroclaw-labs/zeroclaw/blob/d47b5aade3cdbf39c853d06f4af01c4e26eb4994/crates/zeroclaw-channels/src/discord.rs#L2178-L2536).

ZeroClaw's multimodal pipeline uses media markers such as `[IMAGE:...]`, then centralizes provider preparation and capability checks in [`crates/zeroclaw-providers/src/multimodal.rs`](https://github.com/zeroclaw-labs/zeroclaw/blob/d47b5aade3cdbf39c853d06f4af01c4e26eb4994/crates/zeroclaw-providers/src/multimodal.rs#L157-L360). Its ACP docs distinguish `session/cancel` from graceful stop in [`docs/book/src/channels/acp.md`](https://github.com/zeroclaw-labs/zeroclaw/blob/d47b5aade3cdbf39c853d06f4af01c4e26eb4994/docs/book/src/channels/acp.md#L158-L170).

### Nanobot

Nanobot's `BaseChannel` is the cleanest small-channel reference. It defines `start`, `stop`, `send`, optional `send_delta`, `login`, `is_allowed`, and `_handle_message`, and it marks messages as stream-capable via metadata before publishing to the bus in [`nanobot/channels/base.py`](https://github.com/HKUDS/nanobot/blob/4f14f980d92d32474f3fc4381510492148bf2ebb/nanobot/channels/base.py#L21-L240).

The message bus is minimal: `InboundMessage` contains channel, sender, chat, content, media, metadata, and optional session-key override; `OutboundMessage` contains channel, chat, content, media, metadata, buttons in [`nanobot/bus/events.py`](https://github.com/HKUDS/nanobot/blob/4f14f980d92d32474f3fc4381510492148bf2ebb/nanobot/bus/events.py#L20-L55).

Agent streaming is encoded as outbound metadata (`_stream_delta`, `_stream_end`, `_stream_id`), then routed by channel manager to `send_delta` where supported in [`nanobot/agent/loop.py`](https://github.com/HKUDS/nanobot/blob/4f14f980d92d32474f3fc4381510492148bf2ebb/nanobot/agent/loop.py#L604-L765) and [`nanobot/channels/manager.py`](https://github.com/HKUDS/nanobot/blob/4f14f980d92d32474f3fc4381510492148bf2ebb/nanobot/channels/manager.py).

Telegram's `send_delta` buffers and edits preview messages in [`nanobot/channels/telegram.py`](https://github.com/HKUDS/nanobot/blob/4f14f980d92d32474f3fc4381510492148bf2ebb/nanobot/channels/telegram.py#L636-L720). Nanobot's WhatsApp bridge is a useful extension model: Python adapter connects to a localhost Node/Baileys bridge, while `bridge/src/server.ts` binds to `127.0.0.1`, requires `BRIDGE_TOKEN`, rejects browser origins, and requires an auth message within five seconds in [`bridge/src/server.ts`](https://github.com/HKUDS/nanobot/blob/4f14f980d92d32474f3fc4381510492148bf2ebb/bridge/src/server.ts#L1-L70).

Nanobot's `/stop` is a priority command that cancels active session tasks in [`nanobot/command/builtin.py`](https://github.com/HKUDS/nanobot/blob/4f14f980d92d32474f3fc4381510492148bf2ebb/nanobot/command/builtin.py#L122-L130), while mid-turn user messages are injected through a pending queue and `injection_callback` in [`nanobot/agent/runner.py`](https://github.com/HKUDS/nanobot/blob/4f14f980d92d32474f3fc4381510492148bf2ebb/nanobot/agent/runner.py#L229-L245).

## Recommended Rho Architecture

### 1. Reuse Pi's agent loop model; add `AgentRun` metadata

Do not duplicate Pi's event vocabulary. Pi already exposes the right internal lifecycle through `AgentEvent`:

```ts
agent_start
turn_start
message_start
message_update
message_end
tool_execution_start
tool_execution_update
tool_execution_end
turn_end
agent_end
```

Rho should wrap those events with run/channel metadata rather than redefining `text_delta`, `tool_start`, etc. from scratch:

```ts
import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";

type AgentRunEvent = {
  runId: string;
  event: AgentEvent;
};

type AgentRun = {
  id: string;
  sessionId: string;
  source: ChannelSource;
  status: "running" | "completed" | "cancelled" | "failed";
  messages: AgentMessage[];
  abortReason?: CancelReason;
};
```

This gives rho a persisted/cancellable unit of work while keeping Pi as the source of truth for model turns, message updates, tool execution, and agent-loop completion.

### 2. Add only the multimodal extensions Pi does not yet cover

Pi already has text and image parts. Rho should reuse those directly and add durable media parts only where needed:

```ts
type RhoContentPart =
  | TextContent
  | ImageContent
  | AudioContent
  | VideoContent
  | FileContent;

type AudioContent = {
  type: "audio";
  media: MediaRef;
  transcript?: string;
};

type VideoContent = {
  type: "video";
  media: MediaRef;
  transcript?: string;
};

type FileContent = {
  type: "file";
  media: MediaRef;
  name: string;
};
```

For now, these parts can be normalized at channel/media boundaries and rendered into Pi-compatible `TextContent | ImageContent` before calling Pi. Later, if Pi exposes audio/video/file parts, rho should collapse back toward the Pi types.

### 3. Channel streaming should render Pi events, not provider chunks

Provider chunks should terminate at Pi or model adapters. Channels should receive rho run events backed by Pi events:

```txt
external platform
  -> Channel adapter validates/authenticates/normalizes
  -> InboundMessage + media refs + session key
  -> AgentRun registry creates runId + AbortController before ack
  -> Pi Agent.prompt(...) runs
  -> Pi AgentEvent stream is wrapped with runId
  -> channel renders events as SSE, draft edits, final-only messages, etc.
```

This keeps channel auth, media, cancellation, and route ownership outside the model/harness while avoiding a parallel rho event model for things Pi already names.

### 4. Model extensions as factories loaded by server reload

A channel extension should be file-backed and factory-created:

```ts
export interface ChannelDefinition {
  id: string;
  kind: string;
  enabled: boolean;
  config: Record<string, unknown>;
  secrets?: Record<string, SecretRef>;
}

export interface ChannelFactory {
  kind: string;
  create(definition: ChannelDefinition, context: ChannelFactoryContext): Promise<Channel>;
}
```

The server `/reload` should rebuild channels from definitions and swap the runtime registry. The default HTTP channel remains built-in.

### 5. Split authentication into three concepts

- **Connector auth**: token, OAuth, QR session, webhook secret, bridge token. This gets the adapter online.
- **User authorization**: allowlists, pairing, group mention policy. This gates agent execution.
- **Capability authorization**: admin/user tiers for actions like reload, shell, code execution, file upload, PR/commit, outbound messaging.

Fail closed by default: no channel should invoke the agent until user authorization passes.

### 6. Normalize media into typed content parts

Prefer typed `ContentPart` objects internally rather than marker strings:

```ts
type ContentPart =
  | { kind: "text"; text: string }
  | { kind: "image"; mediaId: string; mimeType: string; altText?: string }
  | { kind: "audio"; mediaId: string; mimeType: string; transcript?: string }
  | { kind: "file"; mediaId: string; mimeType: string; name: string };
```

Channels download/upload/store media into a rho media store. Provider adapters decide whether to inline images, pass file paths, or render text breadcrumbs. This avoids ZeroClaw-style marker drift across endpoints while preserving the simplicity of marker rendering at the edge.

### 7. Treat cancellation as an `AgentRun` resource

```ts
interface AgentRunRegistry {
  create(input: InboundMessage): ActiveAgentRun;
  cancel(runId: string, reason: CancelReason): Promise<void>;
  bySession(sessionId: string): ActiveAgentRun | undefined;
}
```

Register the run and abort controller before sending an accepted ack. Propagate cancellation to Pi's `Agent.abort()` / active signal, tool execution, provider stream, and channel delivery. Record the cancellation reason.

### 8. Voice comes later, but design for it now

Voice input can initially be normal media:

```txt
voice message -> audio attachment -> optional transcript -> normal InboundMessage
```

Realtime voice needs a separate session interface:

```ts
interface RealtimeSession {
  id: string;
  receiveAudio(chunk: AudioChunk): Promise<void>;
  interrupt(reason: "barge-in" | "stop" | "disconnect"): Promise<void>;
  sendAudio(chunk: AudioChunk): Promise<void>;
}
```

Do not force realtime audio into the same `send(OutboundMessage)` path.

## Suggested Rho Interface Layers

```txt
@rho/server
  Hono routes, /reload, health, admin gates, dependency injection

@rho/channels
  Channel, ChannelFactory, built-in HttpChannel, future adapters that render AgentRun events

@rho/runtime
  AgentRunRegistry, ChannelRuntime, Pi Agent integration, cancellation, event fanout

@rho/media
  media store, upload/download, MIME sniffing, safe roots, claim-check handles

@rho/auth
  connector secret resolution, user authorization, capability policy
```

Do not build all layers now. The next concrete step is to stream Pi `AgentEvent`s over the HTTP channel and introduce `AgentRun`/`AgentRunRegistry` in the server/runtime boundary.

## Minimal Next Steps for Rho

1. Add `runId`, `sessionId`, and `conversationId` to inbound/outbound metadata.
2. Introduce `AgentRun` and `AgentRunRegistry` around Pi `Agent.prompt(...)`.
3. Stream wrapped Pi `AgentEvent`s through the HTTP channel as SSE.
4. Move mobile HTTP chat from response-completion parsing to real SSE event updates.
5. Sketch `AudioContent`, `VideoContent`, `FileContent`, and `MediaRef` types, but render them to Pi-compatible parts until Pi supports them directly.
6. Keep `/reload` file-backed and factory-based; do not hardcode future WhatsApp/Telegram into core.

## Key Design Principle

Rho should not copy the large gateway frameworks. It should copy the boundary discipline:

> Channels own platform mechanics. The server owns authorization, reload, AgentRun lifecycle, and routing. Pi owns the agent-loop event model where possible. Rho adds only run metadata, channel routing, and missing multimodal extensions.
