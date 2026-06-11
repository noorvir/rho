# Channels

Channels are the surfaces where the user talks to Rho: the web app chat, the
mobile app, and chat platforms added by extensions. Every channel conversation
maps to one persistent conversation history on the server.

## Message flow

1. A channel delivers the user's message to the Rho runtime.
2. The conversation agent produces a reply, streamed when the channel
   supports it.
3. The reply is stored in the conversation history and delivered back through
   the same channel.

Conversation history is persistent and server-owned. Clients fetch it at any
time, so messages produced while the client was away appear on the next fetch.

## What the user can and cannot see

The user sees only message text:

- the user's own messages
- Rho's reply text (streamed deltas, then the final message)
- messages Rho sends later, such as background task outcomes

The user never sees tool calls, tool output, file contents, file paths,
shell commands, or intermediate work. Anything the user needs to know must be
written into the reply text itself.

Replies in channels are for non-technical users: plain language, no file
paths, no stack traces, no schema or code talk unless the user asks for
technical detail.

## Long-running work

Channel conversations must stay responsive. When a request needs more than
roughly a minute of work, the agent starts a background task and replies
immediately with a short acknowledgement and a time expectation. The
conversation connection closes normally.

When the task finishes (or fails, or needs a decision), the outcome is
appended to the conversation as a new message and delivered through the
channel. Clients poll task status while a task is active and refetch the
conversation when it ends, so the user gets the outcome without asking.

## Next

- [Server](server.md)
