import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md";

const variants: Record<ButtonVariant, string> = {
	primary: "bg-primary text-primary-foreground hover:bg-primary/90",
	secondary: "border border-border bg-card hover:bg-muted/60",
	ghost: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
	destructive: "text-destructive hover:bg-destructive/10",
};

const sizes: Record<ButtonSize, string> = {
	sm: "h-8 px-3 text-xs",
	md: "h-10 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
	return (
		<button
			type="button"
			{...props}
			className={cn(
				"inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
				variants[variant],
				sizes[size],
				className,
			)}
		/>
	);
}
