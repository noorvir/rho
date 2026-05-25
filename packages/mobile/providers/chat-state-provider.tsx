import { createContext, type ReactNode, useContext, useReducer } from "react";

export type ChatMode = "collapsed" | "full";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
}

interface ChatState {
	mode: ChatMode;
	messages: ChatMessage[];
}

type ChatAction =
	| { type: "toggle" }
	| { type: "set_mode"; mode: ChatMode }
	| { type: "send"; text: string };

interface ChatStateContextValue {
	state: ChatState;
	toggle(): void;
	setMode(mode: ChatMode): void;
	sendMessage(text: string): void;
}

const initialState: ChatState = {
	mode: "collapsed",
	messages: [
		{
			id: "welcome",
			role: "assistant",
			text: "Ask rho anything. This POC echoes locally for now.",
		},
	],
};

const ChatStateContext = createContext<ChatStateContextValue | null>(null);

export function ChatStateProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(chatReducer, initialState);

	return (
		<ChatStateContext.Provider
			value={{
				state,
				toggle: () => dispatch({ type: "toggle" }),
				setMode: (mode) => dispatch({ type: "set_mode", mode }),
				sendMessage: (text) => dispatch({ type: "send", text }),
			}}
		>
			{children}
		</ChatStateContext.Provider>
	);
}

export function useChatState(): ChatStateContextValue {
	const context = useContext(ChatStateContext);
	if (!context) {
		throw new Error("useChatState must be used inside ChatStateProvider");
	}
	return context;
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
	switch (action.type) {
		case "toggle":
			return { ...state, mode: state.mode === "collapsed" ? "full" : "collapsed" };
		case "set_mode":
			return { ...state, mode: action.mode };
		case "send": {
			const text = action.text.trim();
			if (!text) return state;
			return {
				...state,
				messages: [
					...state.messages,
					{ id: `user-${Date.now()}`, role: "user", text },
					{ id: `assistant-${Date.now()}`, role: "assistant", text: `echo: ${text}` },
				],
			};
		}
	}
}
