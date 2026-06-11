import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export interface BadgeProps {
	children?: ReactNode;
	className?: string;
}

export function Badge({ children, className }: BadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium",
				className,
			)}
		>
			{children}
		</span>
	);
}
