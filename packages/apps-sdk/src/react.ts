import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	type ComponentType,
	createContext,
	createElement,
	type ReactNode,
	useContext,
	useState,
} from "react";
import { createRoot } from "react-dom/client";
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

export interface RhoAppInstance {
	/** Pushes a new host context (for example a route change) into the running app. */
	update(host: RhoAppContext): void;
	unmount(): void;
}

/** The contract between the rho shell and a standalone app bundle. */
export type RhoAppMount = (element: HTMLElement, host: RhoAppContext) => RhoAppInstance;

/**
 * Wraps a React component as a mountable rho app. The returned mount
 * function renders the component with the app bundle's own React, app
 * context provider, and query client — nothing framework-shaped crosses the
 * shell boundary. Use as the app entry's default export:
 * `export default rhoApp(MyApp)`.
 */
export function rhoApp(App: ComponentType): RhoAppMount {
	return (element, host) => {
		const root = createRoot(element);
		const queryClient = new QueryClient();
		let pushHost = (next: RhoAppContext) => {
			host = next;
		};

		function Root() {
			const [current, setCurrent] = useState(host);
			pushHost = setCurrent;
			return createElement(RhoAppProvider, {
				context: current,
				children: createElement(QueryClientProvider, {
					client: queryClient,
					children: createElement(App),
				}),
			});
		}

		root.render(createElement(Root));

		return {
			update(next) {
				pushHost(next);
			},
			unmount() {
				root.unmount();
			},
		};
	};
}
