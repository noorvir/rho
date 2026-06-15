import { useRhoApp } from "@rho/apps-sdk/react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "./cn.ts";
import { Link } from "./link.tsx";

export interface ScreenBack {
	href: string;
	label?: ReactNode;
	/** Replaces the default chevron glyph inside the floating sticky-back button. */
	icon?: ReactNode;
}

export interface ScreenProps {
	title?: ReactNode;
	description?: ReactNode;
	/** Back link for detail screens, rendered above the title. */
	back?: ScreenBack;
	/** Keep the back link pinned while route content scrolls under mobile chrome. */
	stickyBack?: boolean;
	/** Header-level controls, rendered to the right of the title. */
	actions?: ReactNode;
	children?: ReactNode;
	className?: string;
}

interface DragStart {
	pointerId: number;
	x: number;
	y: number;
}

interface BackSwipeDetail {
	phase: "change" | "finish" | "cancel";
	offset?: number;
}

interface BackSwipeEvent {
	detail?: BackSwipeDetail;
}

interface BackSwipeEventTarget {
	addEventListener(type: "rho:back-swipe", listener: (event: BackSwipeEvent) => void): void;
	removeEventListener(type: "rho:back-swipe", listener: (event: BackSwipeEvent) => void): void;
}

/**
 * Page scaffold for one app route: title block, optional back link and
 * actions, and vertical rhythm for its sections. Use exactly one per route.
 */
export function Screen({ title, description, back, stickyBack = false, actions, children, className }: ScreenProps) {
	const rho = useRhoApp();
	const dragStart = useRef<DragStart | null>(null);
	const [dragOffset, setDragOffset] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const [isFinishingBack, setIsFinishingBack] = useState(false);

	const backLink = back ? (
		<Link
			className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
			href={back.href}
		>
			← {back.label ?? "Back"}
		</Link>
	) : null;

	const floatingBackLink = back ? (
		<Link
			aria-label={typeof back.label === "string" ? `Back to ${back.label}` : "Back"}
			className="fixed left-5 top-[calc(env(safe-area-inset-top)-0.125rem)] z-30 inline-flex size-11 items-center justify-center rounded-2xl border border-black/[0.08] bg-white text-foreground shadow-[0_4px_10px_rgba(0,0,0,0.04)] transition-colors hover:bg-white/90"
			href={back.href}
		>
			<span aria-hidden="true" className="inline-flex items-center justify-center">
				{back.icon ?? defaultBackIcon}
			</span>
		</Link>
	) : null;

	const backHref = back?.href;
	const canSwipeBack = stickyBack && typeof backHref === "string";

	useEffect(() => {
		if (!canSwipeBack || typeof backHref !== "string") {
			return;
		}
		const href = backHref;

		const eventTarget = globalThis as unknown as BackSwipeEventTarget;
		function handleBackSwipe(event: BackSwipeEvent) {
			const detail = event.detail;
			if (!detail) {
				return;
			}

			if (detail.phase === "change") {
				setIsDragging(true);
				setIsFinishingBack(false);
				setDragOffset(Math.max(0, detail.offset ?? 0));
				return;
			}

			setIsDragging(false);
			if (detail.phase === "finish") {
				finishBack(href);
				return;
			}

			setDragOffset(0);
		}

		eventTarget.addEventListener("rho:back-swipe", handleBackSwipe);
		return () => {
			eventTarget.removeEventListener("rho:back-swipe", handleBackSwipe);
		};
	}, [backHref, canSwipeBack, rho]);

	function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
		if (!canSwipeBack || event.button !== 0) {
			return;
		}
		dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
		setIsDragging(true);
		setIsFinishingBack(false);
	}

	function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
		const start = dragStart.current;
		if (!start || start.pointerId !== event.pointerId) {
			return;
		}

		const horizontal = Math.max(0, event.clientX - start.x);
		const vertical = Math.abs(event.clientY - start.y);
		if (horizontal < vertical) {
			return;
		}

		setDragOffset(horizontal);
	}

	function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
		const start = dragStart.current;
		if (!start || start.pointerId !== event.pointerId) {
			return;
		}

		const horizontal = event.clientX - start.x;
		const vertical = Math.abs(event.clientY - start.y);
		dragStart.current = null;
		setIsDragging(false);

		const href = backHref;
		if (horizontal > 80 && vertical < 80 && typeof href === "string") {
			finishBack(href);
			return;
		}

		setDragOffset(0);
	}

	function finishBack(href: string) {
		setIsFinishingBack(true);
		setDragOffset(screenWidth());
		globalThis.setTimeout(() => {
			rho.navigate(href);
			setIsFinishingBack(false);
			setDragOffset(0);
		}, 160);
	}

	const contentStyle = stickyBack
		? {
				transform: `translate3d(${dragOffset}px, 0, 0)`,
				transition: isDragging ? "none" : "transform 180ms ease-out",
			}
		: undefined;

	return (
		<>
			{stickyBack ? floatingBackLink : null}
			{canSwipeBack && (
				<div
					aria-hidden="true"
					className="fixed inset-y-0 left-0 z-20 w-7 touch-none"
					onPointerCancel={handlePointerEnd}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerEnd}
				/>
			)}
			<main
				className={cn(
					"mx-auto w-full max-w-3xl space-y-6 px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)]",
					stickyBack
						? "pt-[calc(env(safe-area-inset-top)+3.5rem)]"
						: "pt-[calc(env(safe-area-inset-top)+0.75rem)]",
					className,
				)}
				style={contentStyle}
				data-swipe-state={isFinishingBack ? "finishing" : isDragging ? "dragging" : undefined}
			>
				{stickyBack ? null : backLink}
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
		</>
	);
}

function screenWidth() {
	return (globalThis as { innerWidth?: number }).innerWidth ?? 480;
}

const defaultBackIcon = (
	<svg
		aria-hidden="true"
		fill="none"
		height="22"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="2.25"
		viewBox="0 0 24 24"
		width="22"
	>
		<polyline points="15 6 9 12 15 18" />
	</svg>
);
