import { Outlet } from "@tanstack/react-router";
import { ChatPanel } from "./chat-panel.tsx";

const navigationItems = [
	{ href: "#apps", label: "Apps" },
	{ href: "#chat", label: "Chat" },
	{ href: "/table", label: "Table" },
	{ href: "#settings", label: "Settings" },
];

export function AdminShell() {
	return (
		<div className="h-dvh overflow-hidden bg-background text-foreground">
			<div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
				<header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">
							rho
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight">Web admin</h1>
					</div>

					<nav aria-label="Main navigation" className="flex flex-wrap gap-2">
						{navigationItems.map((item) => (
							<a
								className="inline-flex h-8 items-center border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
								href={item.href}
								key={item.href}
							>
								{item.label}
							</a>
						))}
					</nav>
				</header>

				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-6 lg:flex-row">
					<main className="flex min-h-0 flex-1">
						<Outlet />
					</main>
					<ChatPanel />
				</div>
			</div>
		</div>
	);
}
