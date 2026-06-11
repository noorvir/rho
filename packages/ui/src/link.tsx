import { useRhoApp } from "@rho/apps-sdk/react";
import type { MouseEvent, ReactNode } from "react";

export interface LinkProps {
	/** App-relative route path, e.g. "/day/2026-06-08" or "/". */
	href: string;
	children?: ReactNode;
	className?: string;
}

/**
 * In-app navigation link. Renders a real anchor (cmd-click and middle-click
 * open normally) but navigates client-side through the rho host, so the app
 * never full-page-reloads when moving between its own routes.
 */
export function Link({ href, children, className }: LinkProps) {
	const rho = useRhoApp();
	const target = href === "/" ? rho.app.basePath : `${rho.app.basePath}${href}`;

	function onClick(event: MouseEvent<HTMLAnchorElement>) {
		const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
		if (event.defaultPrevented || modified || event.button !== 0) {
			return;
		}
		event.preventDefault();
		rho.navigate(href);
	}

	return (
		<a className={className} href={target} onClick={onClick}>
			{children}
		</a>
	);
}
