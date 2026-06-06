import {
	IconActivity,
	IconBox,
	IconChevronRight,
	IconCode,
	IconSettings,
} from "@tabler/icons-react";

const stats = [
	{ label: "Apps", value: "0", icon: IconBox },
	{ label: "Runs", value: "0", icon: IconActivity },
	{ label: "Routes", value: "3", icon: IconCode },
];

const rows = [
	{ name: "Web shell", status: "Active", type: "First-party" },
	{ name: "Chat rail", status: "Streaming", type: "Agent" },
	{ name: "App surface", status: "Empty", type: "Content" },
];

export function Dashboard() {
	return (
		<section className="flex min-h-0 flex-1 flex-col border border-border bg-card shadow-sm shadow-foreground/5">
			<header className="flex items-center justify-between border-b border-border px-3 py-2">
				<div>
					<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
						Admin
					</p>
					<h2 className="mt-1 text-sm font-semibold">Workspace</h2>
				</div>
				<a
					className="inline-flex h-7 items-center gap-1 border border-border bg-background px-2 text-xs font-medium hover:bg-muted"
					href="#settings"
				>
					<IconSettings className="size-3.5" />
					Configure
				</a>
			</header>

			<div className="grid gap-2 border-b border-border p-2 sm:grid-cols-3">
				{stats.map((stat) => (
					<div className="border border-border bg-background p-2" key={stat.label}>
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground">{stat.label}</p>
							<stat.icon className="size-3.5 text-muted-foreground" />
						</div>
						<p className="mt-2 text-xl font-semibold tracking-tight">{stat.value}</p>
					</div>
				))}
			</div>

			<div className="min-h-0 flex-1 overflow-auto p-2">
				<div className="min-w-[34rem] border border-border">
					<div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_2rem] border-b border-border bg-muted/60 px-2 py-1.5 text-xs font-medium text-muted-foreground">
						<div>Name</div>
						<div>Status</div>
						<div>Type</div>
						<div />
					</div>
					{rows.map((row) => (
						<a
							className="grid grid-cols-[1.4fr_0.8fr_0.8fr_2rem] items-center border-b border-border px-2 py-2 text-xs last:border-b-0 hover:bg-muted/60"
							href="#apps"
							key={row.name}
						>
							<div className="font-medium text-foreground">{row.name}</div>
							<div className="text-muted-foreground">{row.status}</div>
							<div className="text-muted-foreground">{row.type}</div>
							<IconChevronRight className="size-3.5 text-muted-foreground" />
						</a>
					))}
				</div>
			</div>
		</section>
	);
}
