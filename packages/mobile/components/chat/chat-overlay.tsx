import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatState } from "../../providers/chat-state-provider.tsx";
import { useRhoTheme } from "../../providers/theme-provider.tsx";
import { ChatInput } from "./chat-input.tsx";
import { ChatMessageList } from "./chat-message-list.tsx";

const margin = 8;
const topOffset = 24;

export function ChatOverlay() {
	const insets = useSafeAreaInsets();
	const { state, setMode, sendMessage } = useChatState();
	const { theme } = useRhoTheme();

	if (state.mode === "collapsed") return null;

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
			<Pressable
				style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.backdrop }]}
				onPress={() => setMode("collapsed")}
			/>

			<View
				style={[
					styles.panel,
					{
						top: insets.top + topOffset,
						bottom: insets.bottom + margin,
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.border,
					},
				]}
			>
				<View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
					<View>
						<Text style={[styles.title, { color: theme.colors.text }]}>rho chat</Text>
						<Text style={[styles.subtitle, { color: theme.colors.muted }]}>Local echo POC</Text>
					</View>
					<Pressable
						onPress={() => setMode("collapsed")}
						accessibilityRole="button"
						accessibilityLabel="Close chat"
					>
						<Text style={[styles.close, { color: theme.colors.muted }]}>×</Text>
					</Pressable>
				</View>

				<View style={styles.messages}>
					<ChatMessageList messages={state.messages} />
				</View>

				<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
					<ChatInput bottomInset={0} onSend={sendMessage} />
				</KeyboardAvoidingView>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	panel: {
		borderRadius: 24,
		borderWidth: StyleSheet.hairlineWidth,
		left: margin,
		overflow: "hidden",
		position: "absolute",
		right: margin,
		zIndex: 10,
	},
	header: {
		alignItems: "center",
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingVertical: 14,
	},
	title: {
		fontSize: 18,
		fontWeight: "800",
	},
	subtitle: {
		fontSize: 13,
		marginTop: 2,
	},
	close: {
		fontSize: 34,
		lineHeight: 34,
	},
	messages: {
		flex: 1,
	},
});
