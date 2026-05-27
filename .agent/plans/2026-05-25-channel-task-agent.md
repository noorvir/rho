# Current Work: Pi-backed AgentRun Streaming

## Goal

Replace the fake/final-only HTTP chat path with a Pi-backed `AgentRun` path that streams Pi agent events to the mobile app over SSE. Reuse Pi's `AgentEvent`, `AgentMessage`, `TextContent`, and `ImageContent` types wherever possible. Define only the small rho-owned shape around run metadata, channel routing, cancellation, and future media extensions.

## Current State

The repository now has a Hono `@rho/server`, a persistent built-in `HttpChannel`, `/health`, `/reload`, and a mobile chat that can call the HTTP endpoint and render an echo response. The current server still uses the fake/echo agent and mobile parses the SSE response after completion. The next implementation should use Pi's agent loop and stream real events incrementally.

## Server Shape

Add `@rho/server` as the default local server process. Use Hono for routing and keep dependencies injected so the server can later reload channels/apps without rebuilding the whole process.

Pseudocode:

```ts
type ServerDeps = {
  agent: Agent;
  runtime: ChannelRuntime;
  channels: ChannelRegistry;
  apps: AppRegistry;
};

function createServer(deps: ServerDeps): Hono {
  const app = new Hono();

  app.post("/channels/http/messages", (context) =>
    handleHttpMessage(context, deps)
  );

  app.get("/health", (context) => context.json({ ok: true }));
  app.post("/reload", (context) => reload(deps));

  return app;
}
```

Server startup owns long-lived process state, but channel/app definitions should come from files so they can be reloaded while the process stays alive:

```ts
const files = new FileBackedRegistrySource({ root: rhoDir });
const agent = await getAgent(files);
const channels = new ChannelRegistry();
const apps = new AppRegistry();

await reload({ files, channels, apps });

const runtime = new ChannelRuntime({
  channels: channels.current(),
  handle: createAgentHandler(agent),
});

serve(createServer({ agent, runtime, channels, apps, files }));
```

The request handler should not create a new runtime. It only creates request-local state, such as an SSE response stream. Reload routes can rebuild channels/apps from disk and swap them into the registries without restarting Hono.

## Message Flow

The channel interface is directional:

- External systems do not call `receive` on a channel.
- External input is converted into an `InboundMessage` and passed to `ChannelRuntime.receive(...)`.
- The runtime calls the AI/handler and gets an `OutboundMessage`.
- The runtime then calls `channel.send(outbound)` to deliver the response through the originating channel.

For HTTP:

```txt
mobile chat
  -> POST /channels/http/messages
  -> Hono handler validates JSON
  -> Hono handler creates request-local SSE stream
  -> HttpChannel attaches stream by response id
  -> Hono handler creates InboundMessage(channel: "http", metadata.responseId)
  -> ChannelRuntime.receive(inbound)
  -> AI handler returns OutboundMessage(metadata.responseId)
  -> ChannelRuntime calls HttpChannel.send(outbound)
  -> HttpChannel looks up response id and writes SSE events
```

The persistent `HttpChannel` owns the map of active response streams. The Hono request owns one stream and registers it before calling the runtime.

## AgentRun Model

Rho should not invent a parallel agent event vocabulary. Pi already exposes the agent loop as `AgentEvent`:

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

Rho adds the persistent/cancellable wrapper:

```ts
import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";

type AgentRun = {
  id: string;
  sessionId: string;
  source: ChannelSource;
  status: "running" | "completed" | "cancelled" | "failed";
  messages: AgentMessage[];
  abortReason?: CancelReason;
};

type AgentRunEvent = {
  runId: string;
  event: AgentEvent;
};
```

Future multimedia should extend Pi content parts only where Pi lacks coverage:

```ts
type RhoContentPart =
  | TextContent
  | ImageContent
  | AudioContent
  | VideoContent
  | FileContent;
```

For now, audio/video/file are shape-only. They should normalize through media refs and be rendered into Pi-compatible text/image parts before calling Pi.

## HTTP Contract

```ts
POST /channels/http/messages
body: {
  conversationId: string;
  sender: { id: string; name: string };
  text: string;
}

response: text/event-stream

event: agent.run.started
data: { runId: string }

event: agent.event
data: { runId: string, event: AgentEvent }

event: agent.run.completed
data: { runId: string }

event: agent.run.cancelled
data: { runId: string, reason: string }

event: agent.run.error
data: { runId: string, error: string }
```

## Implementation Sketch

Request conversion:

```ts
function messageFromHttp(input, responseId): InboundMessage {
  return inboundMessage(input.text, {
    channel: "http",
    conversation: { id: input.conversationId, type: "dm" },
    sender: input.sender,
    metadata: { responseId },
    raw: input,
  });
}
```

HTTP channel:

```ts
class HttpChannel implements Channel {
  name = "http";
  kind = "web";
  private streams = new Map<string, SseStream>();

  attach(responseId: string, stream: SseStream) {
    this.streams.set(responseId, stream);
  }

  async send(message: OutboundMessage) {
    const responseId = readResponseId(message.metadata);
    const stream = this.streams.get(responseId);
    if (!stream) return missingStreamReceipt(responseId);

    stream.started(message.replyTo);
    stream.delta(message.text);
    stream.completed(message.text);
    stream.close();
    this.streams.delete(responseId);

    return { ok: true, messageId: newId(), raw: null };
  }
}
```

Hono handler:

```ts
async function handleHttpMessage(context, deps) {
  const input = validateHttpMessage(await context.req.json());
  const responseId = newId();
  const stream = createSseStream();

  deps.channels.http.attach(responseId, stream);

  deps.runtime.receive(messageFromHttp(input, responseId)).catch((error) => {
    stream.error(error);
    stream.close();
    deps.channels.http.detach(responseId);
  });

  return stream.response;
}
```

## Implementation Plan

1. **Server run boundary**
   - Add `AgentRun` and `AgentRunRegistry` in the server/runtime layer.
   - Store active runs by `runId` and `sessionId`.
   - Each run owns an `AbortController`, source channel metadata, status, and final Pi messages.

2. **Pi agent integration**
   - Construct a Pi `Agent` with rho's configured model/tools.
   - For an HTTP chat request, create a run and call `agent.prompt(...)`.
   - Subscribe to Pi `AgentEvent`s and stream `{ runId, event }` over SSE.
   - Use Pi's existing `message_update` / `AssistantMessageEvent` for text deltas instead of inventing new internal delta events.

3. **HTTP channel streaming**
   - Keep `HttpChannel` as the default built-in channel.
   - Attach request-local SSE streams by `runId` or stream id.
   - Emit `agent.run.started`, repeated `agent.event`, and terminal `agent.run.completed` / `agent.run.error` / `agent.run.cancelled` events.

4. **Mobile streaming**
   - Parse SSE incrementally.
   - Render text from Pi `message_update` events as assistant draft text.
   - Finalize on `agent.run.completed`.

5. **Multimedia shape only**
   - Define or document `MediaRef`, `AudioContent`, `VideoContent`, and `FileContent` as rho extensions.
   - Do not add realtime audio/video transport yet.
   - Convert unsupported media to Pi-compatible text/image content at the boundary until Pi supports those parts directly.

## Reloadability Direction

Hot reload is a key product constraint. Everything configurable should have a file-backed source of truth: channel definitions, app definitions, secrets references, API variables, and local dev options.

The reusable abstraction is a reloadable registry source plus factories:

```ts
interface RegistrySource {
  readChannels(): Promise<ChannelDefinition[]>;
  readApps(): Promise<AppDefinition[]>;
  readSecrets(): Promise<SecretSet>;
}

interface ChannelFactory {
  kind: string;
  create(definition: ChannelDefinition, secrets: SecretSet): Promise<Channel>;
}

async function reload(deps) {
  const secrets = await deps.files.readSecrets();
  const channelDefs = await deps.files.readChannels();
  const appDefs = await deps.files.readApps();

  const channels = await createChannels(channelDefs, deps.channelFactories, secrets);
  deps.channels.replace([deps.httpChannel, ...channels]);
  deps.apps.replace(appDefs);
}
```

Reload route:

```txt
POST /reload
  -> reload server settings/capabilities
  -> read the current registry source, initially files on disk
  -> resolve secrets/API variables
  -> create channel instances through registered factories
  -> swap channel/app registries in memory
  -> keep Hono process alive
```

The default `HttpChannel` is always registered by the server and should survive reloads. Reloaded channels are additional capabilities such as future WhatsApp, Slack, webhooks, or app-serving routes.

The current `ChannelRuntime` stores a channel map at construction, so runtime reload needs one of these seams:

1. Add simple `ChannelRuntime.replaceChannels(channels)` and keep using `ChannelRuntime.receive(...)` directly.
2. Register a stable `ChannelRouter` with the runtime. The router reads from a mutable registry when delivering outbound messages.

Prefer option 1 unless it makes the runtime harder to understand. The first HTTP chat pass can implement `/reload` and the file-backed registry shape even if only the default HTTP channel exists at first.

## Self-healing Direction

The default server should eventually behave like a local service:

- one server per configured port/workspace,
- health endpoint for clients and dev scripts,
- predictable pid/lock file or port check to avoid duplicate instances,
- dev command can start it if missing,
- crash recovery can be handled by the launcher initially, not by complex in-process supervision.

First slice: add health check and clear startup errors. Defer robust supervisor/daemon behavior until the basic server and mobile chat are working. Self-healing should live in a launcher/dev-service command first, not inside request handlers or core route logic.

## Near-term Scope

- Add an `AgentRun`/`AgentRunRegistry` boundary in the server/runtime layer.
- Wire HTTP chat requests into a Pi `Agent.prompt(...)` run instead of `PiEchoAgent.reply(...)`.
- Subscribe to Pi `AgentEvent`s and stream them over the existing SSE response.
- Keep channel-facing streaming as a renderer of Pi events; do not create duplicate internal event names for tool/text/turn events.
- Update mobile chat to consume events incrementally rather than waiting for the full SSE body.
- Sketch `AudioContent`, `VideoContent`, `FileContent`, and `MediaRef` types, but do not implement realtime multimedia yet.
- Keep `/reload` file-backed and preserve the default `HttpChannel`.

## Non-goals

- Auth, persistence, user accounts, production deployment, external tunnels, or push notifications.
- Full app hosting/proxying for microapps beyond the existing placeholder WebViews.
- Durable conversation storage or message history sync.
- Replacing the selected Pi model/provider plumbing beyond what is needed for a minimal run.
- Building a general task/agent orchestration system.
- Realtime audio/video implementation in this pass.
- Full daemon/supervisor implementation in the first pass.
- Filesystem watching or automatic reload in the first pass.

## Design Constraints

- Keep boundaries clean: server owns HTTP/SSE, run lifecycle, and dependency wiring; channels own platform delivery; Pi owns agent-loop events and tool execution where possible.
- Prefer reusing Pi types over creating rho equivalents.
- Do not make CLI depend on server, mobile, or frontend-only code.
- Validate at HTTP boundaries and keep internal message shapes typed.
- Mobile UI should stay compact and safe-area-aware.
- Avoid global singletons where injected dependencies keep the same code testable and reloadable.

## Validation

- `bun run check` passes.
- Starting the server exposes `/health` and the streaming HTTP endpoint.
- A command-line HTTP request receives Pi-backed SSE `agent.event` frames.
- The iOS app can send chat text and display text deltas incrementally in the chat sheet.
- SwiftUI app builds, installs, launches, and is visually inspected after the chat wiring.

## Progress

- [x] Defined minimal channel API shape.
- [x] Implemented first CLI echo path.
- [x] Moved CLI wiring into `@rho/cli` so `@rho/ai` stays standalone.
- [x] Add Hono server package/entrypoint.
- [x] Implement persistent default HTTP channel.
- [x] Validate server streaming independently.
- [x] Wire mobile chat to the HTTP streaming endpoint.
- [x] Validate mobile chat response visually.
- [ ] Define `AgentRun` and `AgentRunRegistry` using Pi types.
- [ ] Stream Pi `AgentEvent`s over HTTP SSE.
- [ ] Render Pi text deltas incrementally in mobile chat.
- [ ] Sketch future audio/video/file content extensions without implementing realtime multimedia.
