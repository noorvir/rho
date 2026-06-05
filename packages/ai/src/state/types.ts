export type ConversationKey = string;

export interface ConversationState {
	key: ConversationKey;
	sessionFile: string;
}

export interface StateManager {
	resolve(key: ConversationKey): Promise<ConversationState>;
}
