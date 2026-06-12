# Current Work: Media attachments through HTTP channel + agent

## Goals

Let the mobile client (and any HTTP channel consumer) send images and voice
messages that actually reach the agent: images seen natively by the model,
voice transcribed to text. Replace the mobile placeholders ("🎤 Voice message
(0:02)", local-only photo thumbnails) with real delivery.

## Non-goals

- Outbound media (agent-generated images/files back to the client) — later.
- WhatsApp/Telegram channel ports.
- Video understanding.
- Live/realtime voice (the `RealtimeChannel` surface stays untouched).

## Research findings (Hermes, OpenClaw)

Both treat inbound media the same way at the core: **attachments are
turn-scoped inputs carried on the message as paths/URLs/bytes, with an
optional text-digest step before the model sees them.**

Hermes (NousResearch/hermes-agent):

- Media attachments are turn-scoped: saved locally, attached to the next
  model call, then out of scope.
- Images have two routing modes (`agent/image_routing.py`): **native** —
  OpenAI-style `image_url` content parts, provider adapters translate to
  vendor formats; **text** — run `vision_analyze` up front and prepend the
  description for non-vision models (lossy fallback).
- Audio is transcribed via configured STT; the transcript becomes the turn
  text.
- Outbound: "deliverable mode" — the agent just writes a file and mentions
  its absolute path; the gateway detects it and sends a native attachment.

OpenClaw:

- Inbound attachments ride the message as `MediaPaths`/`MediaUrls`/
  `MediaTypes`.
- Optional **media understanding** pre-digest: image/audio/video summarized
  into text before the reply pipeline; body becomes `[Audio]` +
  `{{Transcript}}` etc. Provider APIs with CLI fallbacks (e.g. whisper),
  per-entry `maxBytes` caps, fallback chains. Crucially: the original media
  is still delivered to vision-capable models — the digest is an add-on, not
  a replacement.
- Outbound media accepts local path or URL, loads to a buffer, detects the
  media kind, applies per-type size limits.

Rho-specific leverage:

- `packages/channels` already models all of this: `ChannelContent`
  (`ImageContent`/`AudioContent` with `MediaRef`) and `Attachment`
  (`data`/`url`/`file` variants). Nothing new to invent at the type layer.
- The pi SDK accepts images natively on `prompt(text, { images: [{ type:
  "image", source: { type: "base64", mediaType, data } }] })`, so inbound
  images can flow straight through without a vision-fallback layer.
- pi has no audio input → voice requires a transcription step (STT provider)
  before the agent, exactly like Hermes/OpenClaw.

## Current Direction

Follow the Hermes/OpenClaw shape, minimally:

1. **HTTP boundary** (`apps/server`): extend the HTTP message input with
   attachments (base64 data + mimeType + name), validate caps (count, size,
   allowed mime types), and map them into `ChannelMessage.content` /
   `attachments` instead of the hardcoded `attachments: []`.
2. **Core → agent images**: thread image content through
   `handleMessage` → conversation prompt as pi base64 images. The message
   text stays the caption.
3. **Core → agent voice**: a transcription boundary in `packages/ai`
   (provider-backed STT, selection injected via runtime config, not
   hardcoded vendor). Transcript becomes the turn text, marked as a voice
   message; original audio attachment retained on the stored message.
4. **Mobile client**: send pending images and recorded m4a as base64
   attachments on the existing `agent/messages:stream` request; render sent
   images/voice in the local bubble list.

Storage: start with in-memory `data` refs end-to-end (bounded by request
caps). A media directory / `file` refs only if message persistence or replay
needs it — decide during implementation, don't pre-build.

## Open questions

- STT provider + config surface (which env vars, which package owns the
  client).
- Size caps per type (image vs audio) and whether to downscale images
  client-side before upload.
- Should the history endpoint return attachments so mobile can render media
  in past conversations, or is local echo enough for v1?

## Success Criteria

- [ ] Mobile photo/camera send → agent answers questions about the image.
- [ ] Mobile voice message send → agent responds to the transcribed request.
- [ ] Oversized/invalid attachments rejected at the HTTP boundary with clear
      errors.
- [ ] No `process.env` reads outside runtime env modules; provider choice
      injected.

## Tests / Validation

- HTTP boundary unit tests: attachment validation (caps, mime, malformed
  base64).
- One integration test: message with image attachment reaches the agent
  prompt with an image part.
- Manual: phone → photo + "what's in this picture?"; phone → voice memo →
  sensible agent reply.

## Progress

- [x] Research: Hermes + OpenClaw media handling; pi SDK image support.
- [ ] Decide STT provider/config.
- [ ] Implement HTTP attachment boundary.
- [ ] Implement image pass-through to pi.
- [ ] Implement voice transcription.
- [ ] Mobile upload + bubble rendering.
