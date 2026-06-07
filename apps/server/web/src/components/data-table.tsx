import { IconCalendar, IconMinus, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import type {
	ColumnDef,
	ColumnFiltersState,
	RowData,
	SortingState,
	Row as TanStackRow,
	Table as TanStackTable,
	VisibilityState,
} from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { type ReactNode, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
	// biome-ignore lint/correctness/noUnusedVariables: TanStack requires these exact type parameters for declaration merging.
	interface ColumnMeta<TData extends RowData, TValue> {
		cellClassName?: string;
		headClassName?: string;
	}
}

export type StatusTone = "active" | "danger" | "trial" | "neutral";
export type TrendDirection = "up" | "down" | "flat";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	emptyText?: string;
	headerClassName?: string;
	rowClassName?: string | ((row: TanStackRow<TData>) => string);
	tableClassName?: string;
}

export function DataTable<TData, TValue>({
	columns,
	data,
	emptyText = "No results.",
	headerClassName,
	rowClassName,
	tableClassName,
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = useState({});

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		state: {
			columnFilters,
			columnVisibility,
			rowSelection,
			sorting,
		},
	});

	return (
		<Table className={tableClassName}>
			<TableHeader className={headerClassName}>
				{table.getHeaderGroups().map((headerGroup) => (
					<TableRow className="hover:bg-transparent" key={headerGroup.id}>
						{headerGroup.headers.map((header) => (
							<TableHead
								className={header.column.columnDef.meta?.headClassName}
								key={header.id}
								style={{ width: header.getSize() }}
							>
								{header.isPlaceholder
									? null
									: flexRender(header.column.columnDef.header, header.getContext())}
							</TableHead>
						))}
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{table.getRowModel().rows.length ? (
					table.getRowModel().rows.map((row) => (
						<TableRow
							className={typeof rowClassName === "function" ? rowClassName(row) : rowClassName}
							data-state={row.getIsSelected() ? "selected" : undefined}
							key={row.id}
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell className={cell.column.columnDef.meta?.cellClassName} key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))
				) : (
					<TableRow>
						<TableCell className="h-24 text-center" colSpan={columns.length}>
							{emptyText}
						</TableCell>
					</TableRow>
				)}
			</TableBody>
		</Table>
	);
}

export function DataTableSelectHeader<TData>({ table }: { table: TanStackTable<TData> }) {
	return (
		<RowSelect
			ariaLabel="Select all rows"
			checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && "indeterminate")}
			onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
		/>
	);
}

export function DataTableSelectCell<TData>({ row }: { row: TanStackRow<TData> }) {
	return (
		<RowSelect
			ariaLabel="Select row"
			checked={row.getIsSelected()}
			onCheckedChange={(value) => row.toggleSelected(!!value)}
		/>
	);
}

export function DataTableSurface({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				"reference-table relative flex min-h-0 flex-col overflow-hidden bg-card shadow-sm shadow-foreground/5",
				className,
			)}
		>
			{children}
		</section>
	);
}

export function DataTableToolbar({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<header className={cn("flex h-14 items-center justify-between gap-3 px-4", className)}>
			{children}
		</header>
	);
}

export function DataTableControls({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={cn("flex items-center gap-2", className)}>{children}</div>;
}

export function DataTableChip({ children }: { children: ReactNode }) {
	return (
		<div className="inline-flex h-7 items-center overflow-hidden rounded-md bg-card text-sm text-muted-foreground ring-1 ring-border">
			{children}
		</div>
	);
}

export function ChipSeparator() {
	return <Separator className="h-full" orientation="vertical" />;
}

export function DataTableScroll({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn("scrollbar-thin min-w-0 flex-1 overflow-auto overscroll-contain", className)}
		>
			{children}
		</div>
	);
}

export function DataTableRail({ children = "+" }: { children?: ReactNode }) {
	return (
		<div className="separator-l relative w-6 shrink-0 bg-card">
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 text-muted-foreground">
				{children}
			</div>
		</div>
	);
}

export function RowSelect({
	ariaLabel,
	checked,
	onCheckedChange,
}: {
	ariaLabel?: string;
	checked?: boolean | "indeterminate";
	onCheckedChange?: (checked: boolean | "indeterminate") => void;
}) {
	return (
		<Checkbox
			aria-label={ariaLabel}
			checked={checked}
			className="border-green-500 data-checked:border-green-600 data-checked:bg-green-600"
			onCheckedChange={onCheckedChange}
		/>
	);
}

export function StatusDot({ tone }: { tone: StatusTone }) {
	return <span className={cn("size-2 rounded-full", toneClass(tone))} />;
}

export function StatusLabel({ children, tone }: { children: ReactNode; tone: StatusTone }) {
	return (
		<span className="inline-flex items-center gap-2">
			<StatusDot tone={tone} />
			{children}
		</span>
	);
}

export function HealthValue({ value }: { value: number }) {
	return (
		<span className="inline-flex items-center gap-2">
			{value}
			<span className={cn("size-2 rounded-full", healthClass(value))} />
		</span>
	);
}

export function OwnerAvatar({
	className,
	initials,
	name,
}: {
	className: string;
	initials: string;
	name: string;
}) {
	return (
		<span className="inline-flex items-center gap-2">
			<Avatar className={className} size="sm">
				<AvatarFallback className="bg-transparent text-[0.625rem] font-semibold text-white">
					{initials}
				</AvatarFallback>
			</Avatar>
			{name}
		</span>
	);
}

export function Trend({ trend }: { trend: TrendDirection }) {
	if (trend === "up") {
		return <IconTrendingUp className="size-3.5 text-emerald-600" />;
	}
	if (trend === "down") {
		return <IconTrendingDown className="size-3.5 text-red-500" />;
	}
	return <IconMinus className="size-3.5" />;
}

export function DateCell({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex items-center gap-2">
			<IconCalendar className="size-3.5 text-muted-foreground" />
			{children}
		</span>
	);
}

function toneClass(tone: StatusTone): string {
	if (tone === "active") {
		return "bg-emerald-500";
	}
	if (tone === "danger") {
		return "bg-red-500";
	}
	if (tone === "trial") {
		return "bg-violet-500";
	}
	return "bg-muted-foreground";
}

function healthClass(value: number): string {
	if (value >= 80) {
		return "bg-sky-500";
	}
	if (value > 50) {
		return "bg-amber-500";
	}
	return "bg-red-500";
}
