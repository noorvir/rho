import { ScrollView, StyleSheet } from "react-native";
import type { ChatMessage as ChatMessageType } from "../../providers/chat-state-provider.tsx";
import { ChatMessage } from "./chat-message.tsx";

export function ChatMessageList({ messages }: { messages: ChatMessageType[] }) {
	return (
		<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
			{messages.map((message) => (
				<ChatMessage key={message.id} message={message} />
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: {
		padding: 16,
		paddingBottom: 24,
	},
});
