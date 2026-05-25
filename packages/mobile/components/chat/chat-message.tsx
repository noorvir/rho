import { StyleSheet, Text, View } from "react-native";
import type { ChatMessage as ChatMessageType } from "../../providers/chat-state-provider.tsx";
import { useRhoTheme } from "../../providers/theme-provider.tsx";

export function ChatMessage({ message }: { message: ChatMessageType }) {
	const { theme } = useRhoTheme();
	const isUser = message.role === "user";

	return (
		<View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
			<View
				style={[
					styles.bubble,
					{
						backgroundColor: isUser ? theme.colors.accent : theme.colors.surfaceRaised,
					},
				]}
			>
				<Text
					style={[styles.text, { color: isUser ? theme.colors.accentText : theme.colors.text }]}
				>
					{message.text}
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		marginBottom: 10,
	},
	assistantRow: {
		justifyContent: "flex-start",
	},
	userRow: {
		justifyContent: "flex-end",
	},
	bubble: {
		borderRadius: 18,
		maxWidth: "82%",
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	text: {
		fontSize: 16,
		lineHeight: 22,
	},
});
