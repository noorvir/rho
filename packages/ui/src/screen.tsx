import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { Link } from "./link.tsx";

export interface ScreenProps {
	title?: ReactNode;
	description?: ReactNode;
	/** Back link for detail screens, rendered above the title. */
	back?: { href: string; label?: ReactNode };
	/** Header-level controls, rendered to the right of the title. */
	actions?: ReactNode;
	children?: ReactNode;
	className?: string;
}

/**
 * Page scaffold for one app route: title block, optional back link and
 * actions, and vertical rhythm for its sections. Use exactly one per route.
 */
export function Screen({ title, description, back, actions, children, className }: ScreenProps) {
	return (
		<main className={cn("mx-auto w-full max-w-3xl space-y-6", className)}>
			{back && (
				<Link
					className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
					href={back.href}
				>
					← {back.label ?? "Back"}
				</Link>
			)}
			{(title || actions) && (
				<header className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						{title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
						{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
					</div>
					{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
				</header>
			)}
			{children}
		</main>
	);
}
