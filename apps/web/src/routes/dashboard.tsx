import {
	IconActivity,
	IconBox,
	IconChevronRight,
	IconCode,
	IconSettings,
} from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { DataTable, DataTableSurface, StatusLabel, type StatusTone } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface DashboardRow {
	name: string;
	status: string;
	tone: StatusTone;
	type: string;
}

const stats = [
	{ label: "Apps", value: "0", icon: IconBox },
	{ label: "Runs", value: "0", icon: IconActivity },
	{ label: "Routes", value: "3", icon: IconCode },
];

const rows: DashboardRow[] = [
	{ name: "Web shell", status: "Active", tone: "active", type: "First-party" },
	{ name: "Chat rail", status: "Streaming", tone: "trial", type: "Agent" },
	{ name: "App surface", status: "Empty", tone: "neutral", type: "Content" },
];

const columns: ColumnDef<DashboardRow>[] = [
	{
		accessorKey: "name",
		header: "Name",
		size: 240,
		meta: {
			cellClassName: "px-2 font-medium",
			headClassName: "px-2 text-muted-foreground",
		},
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => <StatusLabel tone={row.original.tone}>{row.original.status}</StatusLabel>,
		size: 150,
		meta: {
			cellClassName: "px-2",
			headClassName: "px-2 text-muted-foreground",
		},
	},
	{
		accessorKey: "type",
		header: "Type",
		size: 120,
		meta: {
			cellClassName: "px-2 text-muted-foreground",
			headClassName: "px-2 text-muted-foreground",
		},
	},
	{
		id: "open",
		cell: () => <IconChevronRight className="size-3.5" />,
		enableHiding: false,
		enableSorting: false,
		size: 32,
		meta: {
			cellClassName: "px-2 text-muted-foreground",
			headClassName: "px-2",
		},
	},
];

export function Dashboard() {
	return (
		<DataTableSurface className="flex-1">
			<header className="flex items-center justify-between px-3 py-2">
				<div>
					<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
						Admin
					</p>
					<h2 className="mt-1 text-sm font-semibold">Workspace</h2>
				</div>
				<Button asChild className="h-7 gap-1 px-2 text-xs" variant="outline">
					<a href="#settings">
						<IconSettings className="size-3.5" />
						Configure
					</a>
				</Button>
			</header>

			<Separator />

			<div className="grid gap-2 p-2 sm:grid-cols-3">
				{stats.map((stat) => (
					<MetricCard
						icon={<stat.icon className="size-3.5 text-muted-foreground" />}
						key={stat.label}
						label={stat.label}
						value={stat.value}
					/>
				))}
			</div>

			<Separator />

			<div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-2">
				<DataTable
					columns={columns}
					data={rows}
					headerClassName="bg-muted/40 text-muted-foreground"
					rowClassName="h-9"
					tableClassName="min-w-[34rem] table-fixed text-xs"
				/>
			</div>
		</DataTableSurface>
	);
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
	return (
		<div className="bg-background p-2 ring-1 ring-border/80">
			<div className="flex items-center justify-between gap-2">
				<p className="text-xs text-muted-foreground">{label}</p>
				{icon}
			</div>
			<p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
		</div>
	);
}
