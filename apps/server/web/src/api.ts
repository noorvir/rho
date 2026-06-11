import { createORPCClient, ORPCError, type ORPCErrorCode } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { httpContract } from "../../src/http/contract.ts";

interface RhoProblemDetails {
	type: string;
	title: string;
	status: number;
	detail: string;
	code: string;
	action?: unknown;
	details?: unknown;
}

const conversationId = "mobile-chat";
const apiBaseUrl = window.location.origin;

const link = new OpenAPILink(httpContract, {
	url: apiBaseUrl,
	fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
	customErrorResponseBodyDecoder: (body, response) => {
		const problem = parseProblemDetails(body);
		if (!problem) {
			return undefined;
		}

		return new ORPCError(orpcCodeFromStatus(problem.status || response.status), {
			status: problem.status || response.status,
			message: problem.detail,
			data: problem,
		});
	},
});
export const api: JsonifiedClient<ContractRouterClient<typeof httpContract>> = createORPCClient(link);
export const orpc = createORPCReactQueryUtils(api);

export type ChatEvent =
	| { type: "started" }
	| { type: "delta"; text: string }
	| { type: "completed"; text: string }
	| { type: "error"; error: string };

type ChatHistory = Awaited<ReturnType<typeof api.agent.messages>>;
export type ChatMessage = {
	id: string;
	role: ChatHistory["messages"][number]["role"];
	text: string;
};
export type AppExtensionSummary = Awaited<ReturnType<typeof api.apps.list>>["apps"][number];
export type TaskSummary = Awaited<ReturnType<typeof api.agent.tasks>>["tasks"][number];
export type TableSummary = Awaited<ReturnType<typeof api.data.listTables>>["tables"][number];
export type TableData = Awaited<ReturnType<typeof api.data.table>>;
export type TableColumnInfo = TableData["columns"][number];
export type TableRow = TableData["rows"][number];

export async function* streamChatMessage(text: string): AsyncGenerator<ChatEvent> {
	const events = await api.agent.handleMessageStream({
		conversationId,
		sender: { id: "web-user", name: "Web User" },
		text,
	});

	for await (const event of events) {
		yield event;
	}
}

function parseProblemDetails(body: unknown): RhoProblemDetails | undefined {
	if (!isRecord(body)) {
		return undefined;
	}

	const type = body.type;
	const title = body.title;
	const status = body.status;
	const detail = body.detail;
	const code = body.code;
	if (
		typeof type !== "string" ||
		typeof title !== "string" ||
		typeof status !== "number" ||
		typeof detail !== "string" ||
		typeof code !== "string"
	) {
		return undefined;
	}

	return {
		type,
		title,
		status,
		detail,
		code,
		action: body.action,
		details: body.details,
	};
}

function orpcCodeFromStatus(status: number): ORPCErrorCode {
	if (status === 400) {
		return "BAD_REQUEST";
	}
	if (status === 401) {
		return "UNAUTHORIZED";
	}
	if (status === 404) {
		return "NOT_FOUND";
	}
	if (status === 409) {
		return "CONFLICT";
	}
	if (status >= 500) {
		return "INTERNAL_SERVER_ERROR";
	}

	return "INTERNAL_SERVER_ERROR";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}
