export type ThemeMode = "light" | "dark";

export interface ThemeColors {
	background: string;
	surface: string;
	surfaceRaised: string;
	border: string;
	text: string;
	muted: string;
	accent: string;
	accentText: string;
	backdrop: string;
}

export interface Theme {
	mode: ThemeMode;
	colors: ThemeColors;
	spacing: {
		xs: number;
		sm: number;
		md: number;
		lg: number;
		xl: number;
	};
	radius: {
		sm: number;
		md: number;
		lg: number;
	};
}

const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
};

const radius = {
	sm: 8,
	md: 14,
	lg: 22,
};

export const lightTheme: Theme = {
	mode: "light",
	colors: {
		background: "#f7f7f8",
		surface: "#ffffff",
		surfaceRaised: "#f0f0f3",
		border: "#dedee5",
		text: "#15161a",
		muted: "#6c7280",
		accent: "#4f46e5",
		accentText: "#ffffff",
		backdrop: "rgba(15, 23, 42, 0.45)",
	},
	spacing,
	radius,
};

export const darkTheme: Theme = {
	mode: "dark",
	colors: {
		background: "#101113",
		surface: "#181a1f",
		surfaceRaised: "#252830",
		border: "#2d3038",
		text: "#f6f7fb",
		muted: "#a5adba",
		accent: "#8b8cf6",
		accentText: "#101113",
		backdrop: "rgba(0, 0, 0, 0.55)",
	},
	spacing,
	radius,
};
