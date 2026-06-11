import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export function Spinner({ className }: { className?: string }) {
	return (
		<span
			aria-label="Loading"
			className={cn(
				"inline-block size-5 animate-spin rounded-full border-2 border-border border-t-foreground",
				className,
			)}
			role="status"
		/>
	);
}

/** Centered loading placeholder for a section or screen that is fetching. */
export function LoadingState({ className }: { className?: string }) {
	return (
		<div className={cn("flex items-center justify-center py-12", className)}>
			<Spinner />
		</div>
	);
}

export interface EmptyStateProps {
	title: ReactNode;
	description?: ReactNode;
	/** Optional call to action, e.g. a Button. */
	action?: ReactNode;
	className?: string;
}

/** Friendly placeholder for a list or screen with no content yet. */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
	return (
		<div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
			<p className="text-sm font-medium">{title}</p>
			{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
			{action && <div className="mt-4">{action}</div>}
		</div>
	);
}

export interface ErrorStateProps {
	title?: ReactNode;
	description?: ReactNode;
	/** Optional recovery action, e.g. a retry Button. */
	action?: ReactNode;
	className?: string;
}

/** Placeholder for a failed load. */
export function ErrorState({
	title = "Something went wrong",
	description,
	action,
	className,
}: ErrorStateProps) {
	return (
		<div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
			<p className="text-sm font-medium text-destructive">{title}</p>
			{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
			{action && <div className="mt-4">{action}</div>}
		</div>
	);
}
