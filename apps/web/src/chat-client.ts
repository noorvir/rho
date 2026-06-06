const defaultServerUrl = "http://127.0.0.1:7331";
const conversationId = "mobile-chat";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
}

export type ChatEvent =
	| { type: "started" }
	| { type: "delta"; text: string }
	| { type: "completed"; text: string }
	| { type: "error"; error: string };

interface ChatHistoryResponse {
	messages: Array<{
		role: "user" | "assistant";
		text: string;
	}>;
}

interface TextPayload {
	text: string;
}

interface ErrorPayload {
	error: string;
}

export async function loadChatHistory(): Promise<ChatMessage[]> {
	const response = await fetch(chatUrl(`/agent/conversations/${conversationId}/messages`), {
		headers: authHeaders(),
	});
	if (!response.ok) {
		throw new Error(await responseError(response, "Failed to load chat history"));
	}

	const history = (await response.json()) as ChatHistoryResponse;
	return history.messages.map((message, index) => ({
		id: `history-${index}`,
		role: message.role,
		text: message.text,
	}));
}

export async function* streamChatMessage(text: string): AsyncGenerator<ChatEvent> {
	const response = await fetch(chatUrl("/agent/messages:stream"), {
		method: "POST",
		headers: {
			...authHeaders(),
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			conversationId,
			sender: { id: "web-user", name: "Web User" },
			text,
		}),
	});
	if (!response.ok) {
		throw new Error(await responseError(response, "Failed to send chat message"));
	}
	if (!response.body) {
		throw new Error("Chat stream response did not include a body");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const frames = buffer.split("\n\n");
			buffer = frames.pop() ?? "";

			for (const frame of frames) {
				const event = parseFrame(frame);
				if (event) {
					yield event;
				}
			}
		}

		buffer += decoder.decode();
		const event = parseFrame(buffer);
		if (event) {
			yield event;
		}
	} finally {
		reader.releaseLock();
	}
}

function chatUrl(path: string): string {
	const baseUrl = import.meta.env.VITE_RHO_SERVER_URL || defaultServerUrl;
	return new URL(path, baseUrl).toString();
}

function authHeaders(): HeadersInit {
	const secret = import.meta.env.VITE_RHO_API_SECRET;
	return secret ? { Authorization: `Bearer ${secret}` } : {};
}

async function responseError(response: Response, fallback: string): Promise<string> {
	const body = await response.text();
	return body
		? `${fallback}: HTTP ${response.status} ${body}`
		: `${fallback}: HTTP ${response.status}`;
}

function parseFrame(frame: string): ChatEvent | undefined {
	if (!frame.trim()) {
		return undefined;
	}

	let eventName = "";
	const dataLines: string[] = [];
	for (const line of frame.replaceAll("\r\n", "\n").split("\n")) {
		if (line.startsWith("event: ")) {
			eventName = line.slice(7);
		} else if (line.startsWith("data: ")) {
			dataLines.push(line.slice(6));
		}
	}

	const data = dataLines.join("\n");
	switch (eventName) {
		case "message.started":
			return { type: "started" };
		case "message.delta":
			return { type: "delta", text: decodeJson<TextPayload>(data)?.text ?? "" };
		case "message.completed":
			return { type: "completed", text: decodeJson<TextPayload>(data)?.text ?? "" };
		case "message.error":
			return {
				type: "error",
				error: decodeJson<ErrorPayload>(data)?.error ?? "Unknown server error",
			};
		default:
			return undefined;
	}
}

function decodeJson<T>(data: string): T | undefined {
	try {
		return JSON.parse(data) as T;
	} catch {
		return undefined;
	}
}
