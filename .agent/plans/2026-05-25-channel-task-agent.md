# Current Work: Hono Server + HTTP Channel + Mobile Chat

## Goal

Add a minimal long-running `rho` server that exposes a default HTTP channel for mobile chat. The first implementation can use the existing fake/echo AI response, but the server and mobile app should communicate through a real HTTP streaming path.

## Current State

The repository has a minimal channel runtime, CLI channel, and fake AI echo path. The mobile app has a global chat sheet with local input only. There is not yet a long-running server, HTTP channel, or mobile-to-server chat transport.

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

## Streaming Model

The current channel handler returns one `OutboundMessage`, not an async stream. That means the minimal first version can stream the transport response by emitting the final fake/echo text as one `message.delta` inside `HttpChannel.send(...)`.

That proves the mobile app, Hono endpoint, HTTP channel, and SSE parsing work. It is not yet true token streaming from the AI layer.

True model streaming would require a later contract change, such as:

```ts
type ChannelHandler =
  | ((message: InboundMessage) => Promise<OutboundMessage>)
  | ((message: InboundMessage) => AsyncIterable<OutboundEvent>);
```

Do not add that broader contract until the simple HTTP/SSE path is working.

## HTTP Contract

```ts
POST /channels/http/messages
body: {
  conversationId: string;
  sender: { id: string; name: string };
  text: string;
}

response: text/event-stream

event: message.started
data: { replyTo: string | null }

event: message.delta
data: { text: string }

event: message.completed
data: { text: string }

event: message.error
data: { error: string }
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

- Add `@rho/server` with Hono.
- Add a persistent server startup path with injected `agent`, `ChannelRuntime`, default `HttpChannel`, file-backed registry source, and channel factories.
- Add a minimal `/reload` route that reloads server settings/capabilities from the current registry source and swaps in-memory app/channel registries.
- Define the SSE helper and event names once.
- Convert HTTP request bodies into `InboundMessage` at the HTTP boundary.
- Implement an HTTP channel whose `send` method writes SSE response events to the active stream map.
- Wire the mobile chat sheet to call the local HTTP endpoint and render streamed assistant output.
- Keep fake AI streaming simple: one delta is acceptable for the first pass.

## Non-goals

- Auth, persistence, user accounts, production deployment, external tunnels, or push notifications.
- Full app hosting/proxying for microapps beyond the existing placeholder WebViews.
- Durable conversation storage or message history sync.
- Replacing the fake AI provider with a real model.
- Building a general task/agent orchestration system.
- True AI token streaming in the first HTTP pass.
- Full daemon/supervisor implementation in the first pass.
- Filesystem watching or automatic reload in the first pass.

## Design Constraints

- Keep boundaries clean: server owns HTTP/SSE and dependency wiring, channels own normalized message delivery, AI owns replies, mobile owns UI state.
- Prefer the smallest working streaming contract over a broad protocol framework.
- Do not make CLI depend on server, mobile, or frontend-only code.
- Validate at HTTP boundaries and keep internal message shapes typed.
- Mobile UI should stay compact and safe-area-aware.
- Avoid global singletons where injected dependencies keep the same code testable and reloadable.

## Validation

- `bun run check` passes.
- Starting the server exposes `/health` and the streaming HTTP endpoint.
- A command-line HTTP request can receive a streamed echo/fake response.
- The iOS app can send chat text and display the streamed response in the chat sheet.
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
