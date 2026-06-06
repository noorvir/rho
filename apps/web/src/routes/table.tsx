import {
	IconAdjustmentsHorizontal,
	IconBookmark,
	IconCalendar,
	IconChevronDown,
	IconFilter,
	IconLink,
	IconMinus,
	IconTrendingDown,
	IconTrendingUp,
	IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface Row {
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

const rows: Row[] = [
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

export function TablePage() {
	return (
		<div className="h-dvh bg-background p-3 text-foreground">
			<section className="reference-table relative flex h-full flex-col overflow-hidden bg-card shadow-sm shadow-foreground/5">
				<header className="flex h-14 items-center justify-between gap-3 px-4">
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

					<div className="flex items-center gap-2">
						<ToolButton icon={<IconBookmark className="size-3.5" />} label="Views" />
						<ToolButton icon={<IconAdjustmentsHorizontal className="size-3.5" />} label="Display" />
						<ToolButton icon={<IconLink className="size-3.5" />} label="" />
					</div>
				</header>

				<Separator />

				<div className="flex h-10 items-center px-4">
					<div className="inline-flex h-7 items-center overflow-hidden rounded-md bg-card text-sm text-muted-foreground ring-1 ring-border">
						<span className="px-2">Ordered by</span>
						<Separator className="h-full" orientation="vertical" />
						<span className="px-2 font-medium text-foreground">Revenue</span>
						<Separator className="h-full" orientation="vertical" />
						<button className="inline-flex h-full items-center gap-1 px-2" type="button">
							Descending
							<IconChevronDown className="size-3.5" />
						</button>
						<Separator className="h-full" orientation="vertical" />
						<button className="inline-flex size-7 items-center justify-center" type="button">
							<IconX className="size-3.5" />
						</button>
					</div>
				</div>

				<Separator />

				<div className="flex min-h-0 flex-1">
					<div className="scrollbar-thin min-w-0 flex-1 overflow-auto overscroll-contain">
						<Table className="w-[108rem] table-fixed border-collapse text-sm">
							<TableHeader className="sticky top-0 z-10 bg-card text-muted-foreground">
								<TableRow className="h-12 hover:bg-transparent">
									<TableHead className="w-10 px-4 text-muted-foreground">
										<SelectBox />
									</TableHead>
									<TableHead className="w-56 separator-r px-3 text-muted-foreground">
										Company
									</TableHead>
									<TableHead className="w-32 px-3 text-muted-foreground">Plan</TableHead>
									<TableHead className="w-28 px-3 text-muted-foreground">Region</TableHead>
									<TableHead className="w-24 px-3 text-muted-foreground">Seats</TableHead>
									<TableHead className="w-32 px-3 text-muted-foreground">Status</TableHead>
									<TableHead className="w-48 px-3 text-muted-foreground">Responsible</TableHead>
									<TableHead className="w-32 px-3 text-muted-foreground">Health</TableHead>
									<TableHead className="w-32 px-3 text-muted-foreground">Revenue</TableHead>
									<TableHead className="w-12 px-3 text-muted-foreground">↓</TableHead>
									<TableHead className="w-44 px-3 text-muted-foreground">Renewal</TableHead>
									<TableHead className="w-36 px-3 text-muted-foreground">Tags</TableHead>
									<TableHead className="w-40 px-3 text-muted-foreground">Contact</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<DataRow key={row.company} row={row} />
								))}
								<GroupRow />
							</TableBody>
						</Table>
					</div>

					<div className="separator-l relative w-6 shrink-0 bg-card">
						<div className="absolute top-1/2 left-1/2 -translate-x-1/2 text-muted-foreground">
							+
						</div>
					</div>
				</div>
			</section>
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

function DataRow({ row }: { row: Row }) {
	return (
		<TableRow className="h-12">
			<TableCell className="px-4">
				<SelectBox />
			</TableCell>
			<TableCell className="separator-r px-3 font-medium">{row.company}</TableCell>
			<TableCell className="px-3">{row.plan}</TableCell>
			<TableCell className="px-3">{row.region}</TableCell>
			<TableCell className="px-3">{row.seats}</TableCell>
			<TableCell className="px-3">
				<span className="inline-flex items-center gap-2">
					<span className={`size-2 rounded-full ${statusColor(row.status)}`} />
					{row.status}
				</span>
			</TableCell>
			<TableCell className="px-3">
				<span className="inline-flex items-center gap-2">
					<Avatar className={ownerColors[row.owner]} size="sm">
						<AvatarFallback className="bg-transparent text-[0.625rem] font-semibold text-white">
							{row.initials}
						</AvatarFallback>
					</Avatar>
					{row.owner}
				</span>
			</TableCell>
			<TableCell className="px-3">
				<span className="inline-flex items-center gap-2">
					{row.health}
					<span className={`size-2 rounded-full ${healthColor(row.health)}`} />
				</span>
			</TableCell>
			<TableCell className="px-3 font-semibold">{row.revenue}</TableCell>
			<TableCell className="px-3 text-muted-foreground">
				<Trend trend={row.trend} />
			</TableCell>
			<TableCell className="px-3">
				<span className="inline-flex items-center gap-2">
					<IconCalendar className="size-3.5 text-muted-foreground" />
					{row.renewal}
				</span>
			</TableCell>
			<TableCell className="px-3 text-muted-foreground">—</TableCell>
			<TableCell className="px-3 text-muted-foreground">—</TableCell>
		</TableRow>
	);
}

function GroupRow() {
	return (
		<TableRow className="h-12 font-semibold hover:bg-transparent">
			<TableCell className="px-4 text-muted-foreground">⌄</TableCell>
			<TableCell className="separator-r px-3">
				Team <span className="font-normal text-muted-foreground">28</span>
			</TableCell>
			<TableCell colSpan={11} />
		</TableRow>
	);
}

function SelectBox() {
	return (
		<Checkbox className="border-green-500 data-checked:border-green-600 data-checked:bg-green-600" />
	);
}

function Trend({ trend }: { trend: Row["trend"] }) {
	if (trend === "up") {
		return <IconTrendingUp className="size-3.5 text-emerald-600" />;
	}
	if (trend === "down") {
		return <IconTrendingDown className="size-3.5 text-red-500" />;
	}
	return <IconMinus className="size-3.5" />;
}

function statusColor(status: Row["status"]): string {
	if (status === "Active") {
		return "bg-emerald-500";
	}
	if (status === "At risk") {
		return "bg-red-500";
	}
	return "bg-violet-500";
}

function healthColor(health: number): string {
	if (health >= 80) {
		return "bg-sky-500";
	}
	if (health > 50) {
		return "bg-amber-500";
	}
	return "bg-red-500";
}
