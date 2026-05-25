import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { darkTheme, lightTheme, type Theme, type ThemeMode } from "../constants/theme.ts";

type ThemePreference = "system" | ThemeMode;

interface ThemeContextValue {
	theme: Theme;
	preference: ThemePreference;
	setPreference(preference: ThemePreference): void;
	toggleTheme(): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function RhoThemeProvider({ children }: { children: ReactNode }) {
	const [preference, setPreference] = useState<ThemePreference>("light");

	const mode = preference === "system" ? "light" : preference;
	const theme = mode === "dark" ? darkTheme : lightTheme;

	const value = useMemo(
		() => ({
			theme,
			preference,
			setPreference,
			toggleTheme: () => setPreference(mode === "dark" ? "light" : "dark"),
		}),
		[mode, preference, theme],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useRhoTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useRhoTheme must be used inside RhoThemeProvider");
	}
	return context;
}
