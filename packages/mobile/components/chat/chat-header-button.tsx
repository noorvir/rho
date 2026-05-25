import { Pressable, StyleSheet, Text } from "react-native";
import { useChatState } from "../../providers/chat-state-provider.tsx";
import { useRhoTheme } from "../../providers/theme-provider.tsx";

export function ChatHeaderButton() {
	const { state, toggle } = useChatState();
	const { theme } = useRhoTheme();

	if (state.mode === "full") return null;

	return (
		<Pressable
			onPress={toggle}
			accessibilityRole="button"
			accessibilityLabel="Open chat"
			style={styles.button}
		>
			<Text style={[styles.label, { color: theme.colors.text }]}>Chat</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		paddingHorizontal: 4,
		paddingVertical: 4,
	},
	label: {
		fontSize: 16,
		fontWeight: "500",
	},
});
