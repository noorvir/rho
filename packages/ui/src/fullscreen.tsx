import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "./cn.ts";

export interface FullscreenProps {
	/** Accessible title for the fullscreen surface. */
	title: ReactNode;
	/** Called when the user presses Escape or the close button. */
	onClose: () => void;
	children?: ReactNode;
	footer?: ReactNode;
	closeLabel?: string;
	className?: string;
	contentClassName?: string;
}

/**
 * Fullscreen layer for app surfaces that need to escape Screen layout,
 * transforms, and sticky navigation controls.
 */
export function Fullscreen({
	title,
	onClose,
	children,
	footer,
	closeLabel = "Close",
	className,
	contentClassName,
}: FullscreenProps) {
	const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setPortalRoot(document.body);

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose]);

	if (!portalRoot) {
		return null;
	}

	return createPortal(
		<div
			aria-label={typeof title === "string" ? title : undefined}
			aria-modal="true"
			className={cn("fixed inset-0 z-[100] flex flex-col bg-black text-white", className)}
			role="dialog"
		>
			<header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
				<h2 className="min-w-0 truncate text-base font-semibold">{title}</h2>
				<button
					className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
					onClick={onClose}
					type="button"
				>
					{closeLabel}
				</button>
			</header>

			<div className={cn("min-h-0 flex-1 overflow-hidden", contentClassName)}>{children}</div>

			{footer && (
				<footer className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 text-center text-xs text-white/65">
					{footer}
				</footer>
			)}
		</div>,
		portalRoot,
	);
}
