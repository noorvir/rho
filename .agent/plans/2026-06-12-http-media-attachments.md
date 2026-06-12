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
- Full store layout design (memories, journals, artifacts, agent cwd
  integration) — deliberate later pass; v1 is conversation uploads only.
- S3 backup / FUSE mount — only constrain the design (plain files, paths as
  identity) so these stay possible.

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
  "image", source: { type: "base64", mediaType, data } }] })`. Verified:
  pi's own TUI paste/`@file.png` flow reads the file from disk and converts
  to exactly this base64 part — the model API always gets base64. pi
  persists the user turn (including image parts) in its session file.
- pi has no audio input → voice requires a transcription step (STT provider)
  before the agent, exactly like Hermes/OpenClaw.

## Current Direction

Images first, end-to-end, with disk-backed media storage (no S3) and
history that returns attachment references.

**The store (rho's blob store / agent filesystem):**

- A plain directory tree rooted at a server-configured path
  (`RHO_STORE_DIR`). The filesystem is the store: paths are identity, no
  metadata database, mime derived from extension. This keeps it
  FUSE-mountable and verbatim-backupable to S3 later.
- Modeled on OpenClaw's agent workspace: a plain home directory the agent
  owns, where memories/journals/notes are ordinary markdown files. The full
  layout (memories, artifacts, notes) is a later design pass; v1 implements
  only conversation uploads: `uploads/<conversationKey>/<uuid>.<ext>`.

**HTTP API (apps/server, root-level `/store`):**

- `GET /store/<path>` — authed; streams **any** file in the store with the
  right content type. Path-traversal guarded (resolved path must stay under
  the store root). This is the general download API — history thumbnails,
  and later memories/artifacts, all come from here.
- `POST /store/uploads` — conversation upload (base64 JSON body with
  conversationId, name, mimeType, data), enforces caps, writes the file,
  returns `{ path }` (store-relative).
- `agent/messages:stream` body gains `attachments: [{ path }]` — messages
  reference store paths instead of inlining bytes.

**Message pipeline:**

- `messageFromHttp` resolves store paths → `ImageContent` with `file`
  `MediaRef`s on `ChannelMessage.content` (replacing the hardcoded
  `attachments: []`).
- Core/ai: extend the conversation input so the turn carries image refs;
  `runConversation` reads the files, base64s them, and passes
  `session.prompt(text, { images })` — identical to pi's own paste flow.

**History references:**

- Context: rho keeps no message database — history is re-derived from the pi
  session file, which records image bytes but no ids/paths we can serve back
  to clients. So the store path must be recorded next to the user turn.
- Before prompting, append a custom session entry (`rho:attachments`,
  details = `[{ path, mimeType, name }]`); `loadConversation` merges it into
  the adjacent user message. The pi session stays the single source of
  history truth; no parallel message store.
- History messages gain `attachments: [{ path, mimeType, name }]`; clients
  fetch bytes from `GET /store/<path>`.

**Mobile client:**

- On send with pending images: upload each → collect store paths → send
  message with `attachments`. Render image bubbles locally; history renders
  via `GET /store/<path>`.

**Voice (after images):** same store + an STT boundary in `packages/ai`
(provider injected via runtime config); transcript becomes the turn text.

## Open questions

- STT provider + config surface (which env vars, which package owns the
  client).
- Size caps per type and whether to downscale images client-side before
  upload (a 12MP photo is ~3–5 MB; fine on LAN, slow remotely).
- Upload as base64 JSON vs multipart — base64 JSON is simpler with the
  existing oRPC contract; multipart avoids the ~33% overhead.

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
- [x] Verify pi image path: disk → base64 `ImageContent` → `prompt({ images })`.
- [x] Phase 1: store root + `GET /store/<path>` + `POST /store/uploads`.
      Uploads land at `uploads/sessions/<session-id>/<uuid>.<ext>`.
- [x] Phase 2: attachments on messages:stream → pi prompt images; curl demo
      passed (agent accurately described an uploaded screenshot).
- [x] Phase 3: history attachment refs (parsed from `[attachment: ...]`
      prompt lines; no sidecar entry needed).
- [ ] Phase 4: mobile upload + image bubbles.
- [ ] Phase 5: voice/STT.
- [ ] Decide STT provider/config.
