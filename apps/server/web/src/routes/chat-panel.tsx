import { IconCircle, IconRobot, IconSparkles } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Chat } from "@/components/chat";
import { type ChatMessage, loadChatHistory, streamChatMessage } from "@/core-api";
import { cn } from "@/lib/utils";

export function ChatPanel() {
	const [draft, setDraft] = useState("");
	const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>();
	const [isSending, setIsSending] = useState(false);
	const [streamError, setStreamError] = useState<string>();
	const historyQuery = useQuery({ queryKey: ["chat-history"], queryFn: loadChatHistory });
	const messages = sessionMessages ?? historyQuery.data ?? [];
	const error = streamError ?? (historyQuery.error ? errorMessage(historyQuery.error) : undefined);
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollKey = messages.map((message) => `${message.id}:${message.text.length}`).join("|");

	useEffect(() => {
		if (!scrollKey) {
			return;
		}

		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
	}, [scrollKey]);

	async function sendDraft() {
		const text = draft.trim();
		if (!text || isSending) {
			return;
		}

		setDraft("");
		setStreamError(undefined);
		setIsSending(true);

		const assistantId = crypto.randomUUID();
		setSessionMessages((current) => [
			...(current ?? historyQuery.data ?? []),
			{ id: crypto.randomUUID(), role: "user", text },
			{ id: assistantId, role: "assistant", text: "" },
		]);

		try {
			for await (const event of streamChatMessage(text)) {
				if (event.type === "delta") {
					setSessionMessages((current) =>
						appendToMessage(current ?? historyQuery.data ?? [], assistantId, event.text),
					);
				} else if (event.type === "completed" && event.text) {
					setSessionMessages((current) =>
						fillEmptyMessage(current ?? historyQuery.data ?? [], assistantId, event.text),
					);
				} else if (event.type === "error") {
					setStreamError(event.error);
					setSessionMessages((current) =>
						(current ?? historyQuery.data ?? []).filter(
							(message) => message.id !== assistantId || message.text,
						),
					);
				}
			}
		} catch (nextError) {
			setStreamError(errorMessage(nextError));
			setSessionMessages((current) =>
				(current ?? historyQuery.data ?? []).filter(
					(message) => message.id !== assistantId || message.text,
				),
			);
		} finally {
			setIsSending(false);
		}
	}

	return (
		<aside className="flex min-h-0 w-full border border-border bg-card text-card-foreground shadow-sm shadow-foreground/5 lg:w-[23rem]">
			<div className="flex min-h-0 w-full flex-col">
				<header className="flex items-center justify-between border-b border-border px-3 py-2">
					<div className="flex items-center gap-2">
						<span className="flex size-7 items-center justify-center border border-border bg-muted">
							<IconRobot className="size-3.5" />
						</span>
						<div>
							<h2 className="text-sm font-semibold leading-none">Chat</h2>
							<p className="mt-1 text-xs text-muted-foreground">rho agent</p>
						</div>
					</div>
					<span className="inline-flex items-center gap-1 border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
						<IconCircle
							className={cn(
								"size-2.5",
								isSending ? "fill-amber-500 text-amber-500" : "fill-emerald-500 text-emerald-500",
							)}
						/>
						{isSending ? "Streaming" : "Ready"}
					</span>
				</header>

				<div
					className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5"
					ref={scrollRef}
				>
					<div className="space-y-2">
						{historyQuery.isLoading ? <LoadingChat /> : null}
						{messages.length === 0 && !historyQuery.isLoading ? <EmptyChat /> : null}
						{messages.map((message) => (
							<ChatBubble key={message.id} message={message} />
						))}
					</div>
				</div>

				{error ? (
					<div className="border-t border-border px-3 py-2 text-xs text-destructive">{error}</div>
				) : null}

				<div className="border-t border-border bg-background p-2">
					<Chat
						disabled={isSending}
						onChange={setDraft}
						onSubmit={() => void sendDraft()}
						placeholder="Ask rho..."
						value={draft}
					/>
				</div>
			</div>
		</aside>
	);
}

function LoadingChat() {
	return <div className="p-3 text-xs text-muted-foreground">Loading chat...</div>;
}

function EmptyChat() {
	return (
		<div className="border border-dashed border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
			<div className="mb-2 flex items-center gap-1.5 font-medium text-foreground">
				<IconSparkles className="size-3.5" />
				Start a session
			</div>
			Messages stream from the same rho core endpoint used by mobile.
		</div>
	);
}

function ChatBubble({ message }: { message: ChatMessage }) {
	const isUser = message.role === "user";

	return (
		<div className={cn("flex", isUser ? "justify-end pl-8" : "justify-start pr-8")}>
			<div
				className={cn(
					"border px-2.5 py-1.5 text-xs leading-relaxed shadow-sm shadow-foreground/5",
					isUser
						? "border-border bg-muted text-foreground"
						: "border-border bg-card text-muted-foreground",
				)}
			>
				{message.text || "…"}
			</div>
		</div>
	);
}

function appendToMessage(messages: ChatMessage[], id: string, text: string): ChatMessage[] {
	return messages.map((message) =>
		message.id === id ? { ...message, text: message.text + text } : message,
	);
}

function fillEmptyMessage(messages: ChatMessage[], id: string, text: string): ChatMessage[] {
	return messages.map((message) =>
		message.id === id && !message.text ? { ...message, text } : message,
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown chat error";
}
