import { createContext, type ReactNode, useContext } from "react";
import { cn } from "./cn.ts";
import { Link } from "./link.tsx";

// Tracks whether content already sits inside a rendered surface. The first
// List draws the surface; anything nested inside renders flat, so bordered
// boxes cannot end up inside each other.
const SurfaceDepth = createContext(0);

export interface ListProps {
	children?: ReactNode;
	className?: string;
}

/**
 * Grouped rows — the only bordered surface in the library. Fill it with
 * Rows (or custom row content); separators, corners, and hover states are
 * handled here. A List nested inside another surface renders as plain
 * divided rows without a second border.
 */
export function List({ children, className }: ListProps) {
	const depth = useContext(SurfaceDepth);

	return (
		<SurfaceDepth.Provider value={depth + 1}>
			<div
				className={cn(
					"divide-y divide-border",
					depth === 0 && "overflow-hidden rounded-xl border border-border bg-card",
					className,
				)}
			>
				{children}
			</div>
		</SurfaceDepth.Provider>
	);
}

export interface RowProps {
	title: ReactNode;
	subtitle?: ReactNode;
	/** Slot before the title, e.g. a Checkbox or icon. */
	leading?: ReactNode;
	/** Slot after the title, e.g. a Badge or a small Button. */
	trailing?: ReactNode;
	/** App-relative route path; makes the row a navigation link. */
	href?: string;
	/** Makes the row a button. Ignored when href is set. */
	onPress?: () => void;
	className?: string;
}

/**
 * One List row: leading/title/subtitle/trailing layout with a 44px+ tap
 * target. Give it href for navigation or onPress for actions; interactive
 * rows get hover and pressed states automatically.
 */
export function Row({ title, subtitle, leading, trailing, href, onPress, className }: RowProps) {
	const content = (
		<>
			{leading && <span className="flex shrink-0 items-center">{leading}</span>}
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-medium">{title}</span>
				{subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>}
			</span>
			{trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
		</>
	);

	const base = "flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left";
	const interactive = "transition-colors hover:bg-muted/60 active:bg-muted";

	if (href) {
		return (
			<Link className={cn(base, interactive, className)} href={href}>
				{content}
			</Link>
		);
	}
	if (onPress) {
		return (
			<button className={cn(base, interactive, className)} onClick={onPress} type="button">
				{content}
			</button>
		);
	}
	return <div className={cn(base, className)}>{content}</div>;
}
