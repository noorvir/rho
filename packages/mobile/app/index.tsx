import { View } from "react-native";
import { useRhoTheme } from "../providers/theme-provider.tsx";

export default function HomeScreen() {
	const { theme } = useRhoTheme();
	return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
}
