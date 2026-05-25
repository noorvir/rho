import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ChatHeaderButton } from "../components/chat/chat-header-button.tsx";
import { ChatOverlay } from "../components/chat/chat-overlay.tsx";
import { ChatStateProvider } from "../providers/chat-state-provider.tsx";
import { RhoThemeProvider, useRhoTheme } from "../providers/theme-provider.tsx";

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<RhoThemeProvider>
				<ChatStateProvider>
					<RootShell />
				</ChatStateProvider>
			</RhoThemeProvider>
		</SafeAreaProvider>
	);
}

function RootShell() {
	const { theme } = useRhoTheme();

	return (
		<View style={{ flex: 1, backgroundColor: theme.colors.background }}>
			<StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: theme.colors.background },
					headerTintColor: theme.colors.text,
					headerShadowVisible: false,
					headerRight: () => <ChatHeaderButton />,
				}}
			>
				<Stack.Screen name="index" options={{ title: "" }} />
			</Stack>
			<ChatOverlay />
		</View>
	);
}
