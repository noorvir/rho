import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn.ts";

export interface FieldProps {
	label?: ReactNode;
	/** Hint shown under the input; replaced by error when both are set. */
	help?: ReactNode;
	error?: ReactNode;
	children?: ReactNode;
	className?: string;
}

/** Label/input/hint layout for one form control. */
export function Field({ label, help, error, children, className }: FieldProps) {
	let note: ReactNode = null;
	if (error) {
		note = <span className="block text-xs text-destructive">{error}</span>;
	} else if (help) {
		note = <span className="block text-xs text-muted-foreground">{help}</span>;
	}

	return (
		<label className={cn("block space-y-1.5", className)}>
			{label && <span className="block text-sm font-medium">{label}</span>}
			{children}
			{note}
		</label>
	);
}

// text-base on small screens keeps iOS from zooming focused inputs;
// sm:text-sm restores the desktop size.
const controlClasses =
	"w-full rounded-lg border border-border bg-background px-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return <input {...props} className={cn("h-10", controlClasses, className)} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return <textarea {...props} className={cn("min-h-20 py-2", controlClasses, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select {...props} className={cn("h-10", controlClasses, className)}>
			{children}
		</select>
	);
}

export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
	return <input {...props} className={cn("size-5 shrink-0 accent-foreground", className)} type="checkbox" />;
}
