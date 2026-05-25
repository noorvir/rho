import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRhoTheme } from "../../providers/theme-provider.tsx";

interface ChatInputProps {
	bottomInset: number;
	onSend(text: string): void;
}

export function ChatInput({ bottomInset, onSend }: ChatInputProps) {
	const { theme } = useRhoTheme();
	const [text, setText] = useState("");

	const send = () => {
		const value = text.trim();
		if (!value) return;
		onSend(value);
		setText("");
	};

	return (
		<View
			style={[
				styles.container,
				{ borderTopColor: theme.colors.border, paddingBottom: bottomInset + 12 },
			]}
		>
			<TextInput
				value={text}
				onChangeText={setText}
				placeholder="Message rho"
				placeholderTextColor={theme.colors.muted}
				returnKeyType="send"
				onSubmitEditing={send}
				style={[
					styles.input,
					{
						backgroundColor: theme.colors.surfaceRaised,
						color: theme.colors.text,
					},
				]}
			/>
			<Pressable onPress={send} style={[styles.button, { backgroundColor: theme.colors.accent }]}>
				<Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Send</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		alignItems: "center",
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 10,
		paddingHorizontal: 12,
		paddingTop: 12,
	},
	input: {
		borderRadius: 20,
		flex: 1,
		fontSize: 16,
		minHeight: 42,
		paddingHorizontal: 14,
	},
	button: {
		borderRadius: 18,
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	buttonText: {
		fontWeight: "700",
	},
});
