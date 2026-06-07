import { createContext, createElement, type ReactNode, useContext } from "react";
import type { RhoAppContext } from "./index.ts";

const RhoAppContextValue = createContext<RhoAppContext | undefined>(undefined);

export function RhoAppProvider({ context, children }: { context: RhoAppContext; children: ReactNode }) {
	return createElement(RhoAppContextValue.Provider, { value: context }, children);
}

export function useRhoApp(): RhoAppContext {
	const context = useContext(RhoAppContextValue);
	if (!context) {
		throw new Error("useRhoApp must be used inside RhoAppProvider");
	}
	return context;
}
