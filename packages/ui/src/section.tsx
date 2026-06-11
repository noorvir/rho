import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export interface SectionProps {
	title?: ReactNode;
	description?: ReactNode;
	/** Section-level controls, rendered to the right of the title. */
	actions?: ReactNode;
	children?: ReactNode;
	className?: string;
}

/**
 * Semantic group inside a Screen: a small heading plus spacing. Sections
 * never draw borders or backgrounds — visual surfaces come from List —
 * so grouping can nest without producing boxes inside boxes.
 */
export function Section({ title, description, actions, children, className }: SectionProps) {
	return (
		<section className={cn("space-y-2", className)}>
			{(title || actions) && (
				<div className="flex items-end justify-between gap-4">
					<div className="min-w-0">
						{title && (
							<h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
						)}
						{description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
					</div>
					{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
				</div>
			)}
			{children}
		</section>
	);
}
