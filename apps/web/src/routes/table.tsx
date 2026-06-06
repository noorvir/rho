import {
	IconAdjustmentsHorizontal,
	IconBookmark,
	IconChevronDown,
	IconFilter,
	IconLink,
	IconX,
} from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import {
	ChipSeparator,
	DataTable,
	DataTableChip,
	DataTableControls,
	DataTableRail,
	DataTableScroll,
	DataTableSelectCell,
	DataTableSelectHeader,
	DataTableSurface,
	DataTableToolbar,
	DateCell,
	HealthValue,
	OwnerAvatar,
	StatusLabel,
	type StatusTone,
	Trend,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface CustomerRow {
	company: string;
	plan: string;
	region: string;
	seats: string;
	status: "Active" | "At risk" | "Trial";
	owner: string;
	initials: string;
	health: number;
	revenue: string;
	trend: "up" | "down" | "flat";
	renewal: string;
}

const rows: CustomerRow[] = [
	{
		company: "Pinnacle Ventures AI",
		plan: "Starter",
		region: "EU",
		seats: "11",
		status: "Active",
		owner: "Noah Klein",
		initials: "NK",
		health: 90,
		revenue: "$7,904",
		trend: "flat",
		renewal: "Oct 24, 2027",
	},
	{
		company: "Ironwood Cloud Inc",
		plan: "Starter",
		region: "APAC",
		seats: "185",
		status: "At risk",
		owner: "Mia Chen",
		initials: "MC",
		health: 80,
		revenue: "$7,510",
		trend: "down",
		renewal: "Apr 10, 2027",
	},
	{
		company: "Meridian Platform Ltd",
		plan: "Starter",
		region: "EU",
		seats: "129",
		status: "At risk",
		owner: "Camila Torres",
		initials: "CT",
		health: 34,
		revenue: "$6,660",
		trend: "flat",
		renewal: "Jun 6, 2027",
	},
	{
		company: "Cobalt Solutions Co",
		plan: "Starter",
		region: "APAC",
		seats: "142",
		status: "Active",
		owner: "Daniel Park",
		initials: "DP",
		health: 93,
		revenue: "$5,863",
		trend: "up",
		renewal: "Mar 25, 2026",
	},
	{
		company: "Quantum Solutions HQ",
		plan: "Starter",
		region: "NA",
		seats: "168",
		status: "Trial",
		owner: "Elena Petrova",
		initials: "EP",
		health: 33,
		revenue: "$5,299",
		trend: "down",
		renewal: "Jul 1, 2026",
	},
	{
		company: "Cobalt Data Co",
		plan: "Starter",
		region: "APAC",
		seats: "30",
		status: "Trial",
		owner: "Amina Yusuf",
		initials: "AY",
		health: 49,
		revenue: "$4,863",
		trend: "up",
		renewal: "Nov 13, 2026",
	},
	{
		company: "Cobalt Dynamics HQ",
		plan: "Starter",
		region: "APAC",
		seats: "166",
		status: "At risk",
		owner: "Elena Petrova",
		initials: "EP",
		health: 69,
		revenue: "$3,899",
		trend: "down",
		renewal: "Jul 1, 2026",
	},
	{
		company: "Clearpath Intelligence Inc",
		plan: "Starter",
		region: "EU",
		seats: "41",
		status: "Active",
		owner: "Julian Weber",
		initials: "JW",
		health: 80,
		revenue: "$2,838",
		trend: "up",
		renewal: "Dec 5, 2027",
	},
	{
		company: "Clearpath Cloud SaaS",
		plan: "Starter",
		region: "NA",
		seats: "43",
		status: "At risk",
		owner: "Julian Weber",
		initials: "JW",
		health: 72,
		revenue: "$2,818",
		trend: "up",
		renewal: "Apr 19, 2027",
	},
	{
		company: "Sequoia Solutions Co",
		plan: "Starter",
		region: "EU",
		seats: "38",
		status: "Active",
		owner: "Priya Shah",
		initials: "PS",
		health: 29,
		revenue: "$2,551",
		trend: "down",
		renewal: "Nov 18, 2026",
	},
	{
		company: "Frontier Group",
		plan: "Starter",
		region: "NA",
		seats: "120",
		status: "Trial",
		owner: "Fatima Hassan",
		initials: "FH",
		health: 35,
		revenue: "$2,457",
		trend: "up",
		renewal: "Jan 19, 2026",
	},
	{
		company: "Ironwood Cloud SaaS",
		plan: "Starter",
		region: "APAC",
		seats: "67",
		status: "Active",
		owner: "Marcus Lee",
		initials: "ML",
		health: 84,
		revenue: "$2,274",
		trend: "flat",
		renewal: "Aug 8, 2027",
	},
	{
		company: "Solace Analytics LLC",
		plan: "Starter",
		region: "EU",
		seats: "88",
		status: "Active",
		owner: "Priya Shah",
		initials: "PS",
		health: 83,
		revenue: "$1,229",
		trend: "up",
		renewal: "Jan 10, 2026",
	},
];

const ownerColors: Record<string, string> = {
	"Amina Yusuf": "bg-red-500",
	"Camila Torres": "bg-teal-500",
	"Daniel Park": "bg-indigo-500",
	"Elena Petrova": "bg-amber-500",
	"Fatima Hassan": "bg-pink-500",
	"Julian Weber": "bg-orange-500",
	"Marcus Lee": "bg-emerald-500",
	"Mia Chen": "bg-violet-500",
	"Noah Klein": "bg-blue-500",
	"Priya Shah": "bg-sky-500",
};

const columns: ColumnDef<CustomerRow>[] = [
	{
		id: "select",
		header: ({ table }) => <DataTableSelectHeader table={table} />,
		cell: ({ row }) => <DataTableSelectCell row={row} />,
		enableHiding: false,
		enableSorting: false,
		size: 40,
		meta: {
			cellClassName: "px-4",
			headClassName: "w-10 px-4 text-muted-foreground",
		},
	},
	{
		accessorKey: "company",
		header: "Company",
		size: 220,
		meta: {
			cellClassName: "separator-r px-3 font-medium",
			headClassName: "separator-r px-3 text-muted-foreground",
		},
	},
	{
		accessorKey: "plan",
		header: "Plan",
		size: 128,
		meta: { cellClassName: "px-3", headClassName: "px-3 text-muted-foreground" },
	},
	{
		accessorKey: "region",
		header: "Region",
		size: 112,
		meta: { cellClassName: "px-3", headClassName: "px-3 text-muted-foreground" },
	},
	{
		accessorKey: "seats",
		header: "Seats",
		size: 96,
		meta: { cellClassName: "px-3", headClassName: "px-3 text-muted-foreground" },
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => (
			<StatusLabel tone={statusTone(row.original.status)}>{row.original.status}</StatusLabel>
		),
		size: 128,
		meta: { cellClassName: "px-3", headClassName: "px-3 text-muted-foreground" },
	},
	{
		accessorKey: "owner",
		header: "Responsible",
		cell: ({ row }) => (
			<OwnerAvatar
				className={ownerColors[row.original.owner]}
				initials={row.original.initials}
				name={row.original.owner}
			/>
		),
		size: 192,
		meta: { cellClassName: "px-3", headClassName: "px-3 text-muted-foreground" },
	},
	{
		accessorKey: "health",
		header: "Health",
		cell: ({ row }) => <HealthValue value={row.original.health} />,
		size: 128,
		meta: { cellClassName: "px-3", headClassName: "px-3 text-muted-foreground" },
	},
	{
		accessorKey: "revenue",
		header: "Revenue",
		size: 128,
		meta: {
			cellClassName: "px-3 font-semibold",
			headClassName: "px-3 text-muted-foreground",
		},
	},
	{
		accessorKey: "trend",
		header: "↓",
		cell: ({ row }) => <Trend trend={row.original.trend} />,
		size: 48,
		meta: {
			cellClassName: "px-3 text-muted-foreground",
			headClassName: "px-3 text-muted-foreground",
		},
	},
	{
		accessorKey: "renewal",
		header: "Renewal",
		cell: ({ row }) => <DateCell>{row.original.renewal}</DateCell>,
		size: 176,
		meta: { cellClassName: "px-3", headClassName: "px-3 text-muted-foreground" },
	},
	{
		id: "tags",
		header: "Tags",
		cell: () => "—",
		size: 144,
		meta: {
			cellClassName: "px-3 text-muted-foreground",
			headClassName: "px-3 text-muted-foreground",
		},
	},
	{
		id: "contact",
		header: "Contact",
		cell: () => "—",
		size: 160,
		meta: {
			cellClassName: "px-3 text-muted-foreground",
			headClassName: "px-3 text-muted-foreground",
		},
	},
];

export function TablePage() {
	return (
		<div className="h-dvh bg-background p-3 text-foreground">
			<DataTableSurface className="reference-table-wide h-full">
				<DataTableToolbar>
					<div className="flex items-center gap-3">
						<Input
							aria-label="Search"
							className="h-7 w-56 border-0 bg-muted text-sm shadow-none focus-visible:ring-0"
							placeholder="Search"
						/>
						<Button className="h-7 gap-2 px-2 text-sm" type="button" variant="ghost">
							<IconFilter className="size-3.5" />
							Filter
						</Button>
					</div>

					<DataTableControls>
						<ToolButton icon={<IconBookmark className="size-3.5" />} label="Views" />
						<ToolButton icon={<IconAdjustmentsHorizontal className="size-3.5" />} label="Display" />
						<ToolButton icon={<IconLink className="size-3.5" />} label="" />
					</DataTableControls>
				</DataTableToolbar>

				<Separator />

				<div className="flex h-10 items-center px-4">
					<DataTableChip>
						<span className="px-2">Ordered by</span>
						<ChipSeparator />
						<span className="px-2 font-medium text-foreground">Revenue</span>
						<ChipSeparator />
						<button className="inline-flex h-full items-center gap-1 px-2" type="button">
							Descending
							<IconChevronDown className="size-3.5" />
						</button>
						<ChipSeparator />
						<button className="inline-flex size-7 items-center justify-center" type="button">
							<IconX className="size-3.5" />
						</button>
					</DataTableChip>
				</div>

				<Separator />

				<div className="flex min-h-0 flex-1">
					<DataTableScroll>
						<DataTable
							columns={columns}
							data={rows}
							headerClassName="sticky top-0 z-10 bg-card text-muted-foreground"
							rowClassName="h-12"
							tableClassName="w-[108rem] table-fixed border-collapse text-sm"
						/>
						<GroupRow />
					</DataTableScroll>

					<DataTableRail />
				</div>
			</DataTableSurface>
		</div>
	);
}

function ToolButton({ icon, label }: { icon: ReactNode; label: string }) {
	return (
		<Button
			className="h-7 gap-1.5 bg-card px-2 text-sm font-medium shadow-none ring-1 ring-border"
			type="button"
			variant="ghost"
		>
			{icon}
			{label ? <span>{label}</span> : null}
		</Button>
	);
}

function GroupRow() {
	return (
		<div className="grid h-12 w-[108rem] grid-cols-[2.5rem_13.75rem_1fr] items-center border-b text-sm font-semibold">
			<div className="px-4 text-muted-foreground">⌄</div>
			<div className="separator-r px-3">
				Team <span className="font-normal text-muted-foreground">28</span>
			</div>
			<div />
		</div>
	);
}

function statusTone(status: CustomerRow["status"]): StatusTone {
	if (status === "Active") {
		return "active";
	}
	if (status === "At risk") {
		return "danger";
	}
	return "trial";
}
