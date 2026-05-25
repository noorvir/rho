import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
	...config,
	name: "rho",
	slug: "rho-mobile",
	version: "0.0.0",
	orientation: "portrait",
	scheme: "rho",
	userInterfaceStyle: "automatic",
	newArchEnabled: true,
	icon: "./assets/images/icon.png",
	splash: {
		image: "./assets/images/splash-icon.png",
		resizeMode: "contain",
		backgroundColor: "#101113",
	},
	ios: {
		supportsTablet: true,
		bundleIdentifier: "dev.rho.mobile",
	},
	android: {
		package: "dev.rho.mobile",
		edgeToEdgeEnabled: true,
		adaptiveIcon: {
			foregroundImage: "./assets/images/adaptive-icon.png",
			backgroundColor: "#101113",
		},
	},
	web: {
		favicon: "./assets/images/favicon.png",
	},
	plugins: ["expo-router"],
	experiments: {
		typedRoutes: true,
	},
});
