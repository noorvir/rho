import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { httpContract } from "../../src/http/contract.ts";

const defaultCoreUrl = window.location.origin;
const conversationId = "mobile-chat";
const apiBaseUrl = import.meta.env.VITE_RHO_CORE_URL || defaultCoreUrl;

const link = new OpenAPILink(httpContract, {
	url: apiBaseUrl,
	fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
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
