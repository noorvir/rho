# Current Work: Channel Task Agent

## Goals

Define and implement a minimal channel interface that accepts messages, passes them to the AI layer, and sends responses back through the originating channel.

## Non-goals

- Coding-agent shell spawning.
- Task tracking.
- Persistent distributed queue/storage.
- Multiple channel backends beyond the first CLI channel.
- Production-grade process supervision.

## Current Direction

Focus first on `@rho/channels` as a communication interface only. Channels do not spawn agents or own tasks; they normalize inbound messages and deliver outbound messages. `@rho/ai` stays standalone for model/agent response logic. `@rho/cli` owns the command-line entrypoint so future web/mobile packages can stay separate and avoid pulling frontend dependencies into CLI installs.

Shape:

```ts
interface Channel {
	name: string;
	kind: ChannelKind;
	send(message: OutboundMessage): Promise<SendReceipt>;
	start?(context: ChannelContext): Promise<void>;
	stop?(): Promise<void>;
}

interface ChannelContext {
	receive(message: InboundMessage): Promise<void>;
	signal?: AbortSignal;
}
```

Lifecycle methods are optional because web/mobile API handlers and one-shot CLI flows can submit inbound messages directly through the runtime, while websocket, webhook, polling, or stdin channels can opt into `start`/`stop` when they need listeners or teardown.

Directionality:

```txt
external user -> channel -> context.receive(inboundMessage) -> rho
rho -> ChannelHandler returns OutboundMessage -> channel.send(outboundMessage) -> external user
```

Runtime sequence:

```txt
rho serve
  create runtime with configured channels
  call start(context) on channels that need listeners
  keep process alive for webhooks, websockets, polling, or stdin
```

One-shot sequence:

```txt
rho send "hello"
  create or submit one InboundMessage
  call runtime.receive(message) directly or send to a running server
  exit after response/task id as appropriate
```

The runtime handler returns an `OutboundMessage` rather than a string shortcut, so reply targeting stays explicit at the composition boundary.

## Success Criteria

- [x] A CLI message can be submitted as an inbound channel message.
- [x] The message is handed to the AI layer.
- [x] The AI layer returns an echo response via the pi AI package.
- [x] The response is delivered through the originating channel.
- [ ] Basic tests document the expected behavior.

## Tests / Validation

- `bun run check` should pass.
- `bun run rho "hello"` should print `echo: hello`.

## Progress

- [x] Initialized active plan.
- [x] Defined minimal channel API shape.
- [x] Implemented first CLI echo path.
- [x] Moved CLI wiring into `@rho/cli` so `@rho/ai` stays standalone.
- [x] Moved public channel and agent contracts into `types.ts` files.
- [x] Tightened the current contracts where absence is not useful (`Channel.kind`, `AgentInput.timestamp`) while keeping genuinely absent channel fields optional.
- [ ] Add tests for channel/runtime behavior.
