import {
	IconAdjustmentsHorizontal,
	IconBookmark,
	IconChevronDown,
	IconDatabase,
	IconFilter,
	IconLink,
	IconTable,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
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
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	loadTable,
	loadTables,
	type TableColumnInfo,
	type TableData,
	type TableRow,
} from "@/core-api";

export function DataPage({ tableName }: { tableName?: string }) {
	const tablesQuery = useQuery({ queryKey: ["tables"], queryFn: loadTables });
	const tableQuery = useQuery({
		queryKey: ["table", tableName],
		queryFn: () => loadTable(tableName ?? ""),
		enabled: Boolean(tableName),
	});
	const tables = tablesQuery.data ?? [];
	const table = tableQuery.data;
	const selectedTable = tables.find((nextTable) => nextTable.name === tableName);
	const columns = useMemo(() => (table ? dataColumns(table.columns) : []), [table]);
	const rows = table?.rows ?? [];
	const tablesError = queryError(tablesQuery.error, "Failed to load tables");
	const tableError = queryError(tableQuery.error, "Failed to load table");

	return (
		<DataTableSurface className="min-w-0 flex-1">
			<DataTableToolbar>
				<div className="flex items-center gap-3">
					<div className="flex size-7 items-center justify-center bg-muted text-muted-foreground">
						<IconDatabase className="size-3.5" />
					</div>
					<div>
						<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
							Data
						</p>
						<h2 className="text-sm font-semibold">SQLite tables</h2>
					</div>
				</div>

				<DataTableControls>
					<ToolButton icon={<IconBookmark className="size-3.5" />} label="Views" />
					<ToolButton icon={<IconAdjustmentsHorizontal className="size-3.5" />} label="Display" />
					<ToolButton icon={<IconLink className="size-3.5" />} label="" />
				</DataTableControls>
			</DataTableToolbar>

			<Separator />

			<div className="flex min-h-0 flex-1">
				<aside className="flex w-52 shrink-0 flex-col border-r border-border">
					<div className="px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
						Tables
					</div>
					<Separator />
					<div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-2">
						{tablesError ? <p className="p-2 text-xs text-destructive">{tablesError}</p> : null}
						{tablesQuery.isLoading ? (
							<p className="p-2 text-xs text-muted-foreground">Loading...</p>
						) : null}
						{tables.map((nextTable) => (
							<Link
								className="flex h-8 items-center gap-2 px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground"
								key={nextTable.name}
								params={{ tableName: nextTable.name }}
								to="/data/$tableName"
							>
								<IconTable className="size-3.5" />
								{nextTable.label}
							</Link>
						))}
						{!tablesQuery.isLoading && !tablesError && tables.length === 0 ? (
							<p className="p-2 text-xs text-muted-foreground">No tables found.</p>
						) : null}
					</div>
				</aside>

				<section className="flex min-w-0 flex-1 flex-col">
					{tableName ? (
						<TableView
							columns={columns}
							error={tableError}
							loading={tableQuery.isLoading}
							rows={rows}
							table={table}
							tableLabel={selectedTable?.label ?? titleLabel(tableName)}
							tableName={tableName}
						/>
					) : (
						<EmptyDataState />
					)}
				</section>
			</div>
		</DataTableSurface>
	);
}

function queryError(error: Error | null, fallback: string): string | undefined {
	if (!error) {
		return undefined;
	}
	return error.message || fallback;
}

function TableView({
	columns,
	error,
	loading,
	rows,
	table,
	tableLabel,
	tableName,
}: {
	columns: ColumnDef<TableRow>[];
	error?: string;
	loading: boolean;
	rows: TableRow[];
	table?: TableData;
	tableLabel: string;
	tableName: string;
}) {
	return (
		<>
			<div className="flex h-10 items-center justify-between gap-3 px-4">
				<DataTableChip>
					<span className="px-2">SQLite</span>
					<ChipSeparator />
					<span className="px-2 font-medium text-foreground">{tableLabel}</span>
					<ChipSeparator />
					<button className="inline-flex h-full items-center gap-1 px-2" type="button">
						{rows.length} rows
						<IconChevronDown className="size-3.5" />
					</button>
				</DataTableChip>

				<div className="flex items-center gap-2">
					<Input
						aria-label="Search"
						className="h-7 w-48 border-0 bg-muted text-sm shadow-none focus-visible:ring-0"
						placeholder={`Search ${tableName}`}
					/>
					<Button className="h-7 gap-2 px-2 text-sm" type="button" variant="ghost">
						<IconFilter className="size-3.5" />
						Table
					</Button>
				</div>
			</div>

			<Separator />

			<div className="flex min-h-0 flex-1">
				<DataTableScroll>
					{error ? (
						<div className="p-4 text-sm text-destructive">{error}</div>
					) : (
						<DataTable
							columns={columns}
							data={rows}
							emptyText={loading ? "Loading table..." : "No rows found."}
							headerClassName="sticky top-0 z-10 bg-card text-muted-foreground"
							rowClassName="h-12"
							tableClassName="w-[108rem] table-fixed border-collapse text-sm"
						/>
					)}
					<GroupRow count={table ? rows.length : 0} />
				</DataTableScroll>

				<DataTableRail />
			</div>
		</>
	);
}

function EmptyDataState() {
	return (
		<div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
			<div>
				<div className="mx-auto flex size-10 items-center justify-center bg-muted text-muted-foreground">
					<IconTable className="size-4" />
				</div>
				<h3 className="mt-3 text-sm font-semibold">Choose a table</h3>
				<p className="mt-1 max-w-xs text-sm text-muted-foreground">
					Select a SQLite table from the Data list to inspect its columns and rows.
				</p>
			</div>
		</div>
	);
}

function dataColumns(columns: TableColumnInfo[]): ColumnDef<TableRow>[] {
	return [
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
		...columns.map<ColumnDef<TableRow>>((column, index) => ({
			id: column.id,
			header: column.label,
			cell: ({ row }) => tableValue(row.original[column.id], column),
			size: columnSize(column),
			meta: {
				cellClassName: cellClassName(column, index),
				headClassName: headClassName(index),
			},
		})),
	];
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

function GroupRow({ count }: { count: number }) {
	return (
		<div className="grid h-12 w-[108rem] grid-cols-[2.5rem_13.75rem_1fr] items-center border-b text-sm font-semibold">
			<div className="px-4 text-muted-foreground">⌄</div>
			<div className="separator-r px-3">
				Rows <span className="font-normal text-muted-foreground">{count}</span>
			</div>
			<div />
		</div>
	);
}

function tableValue(value: TableRow[string], column: TableColumnInfo): ReactNode {
	if (value === null) {
		return "—";
	}
	if (column.kind === "date") {
		return <DateCell>{formatDate(String(value))}</DateCell>;
	}
	if (column.kind === "boolean") {
		return (
			<Checkbox
				checked={value === true}
				className="border-green-500 data-checked:border-green-600 data-checked:bg-green-600 disabled:opacity-100"
				disabled
			/>
		);
	}
	if (column.kind === "enum") {
		const enumValue = String(value);
		return (
			<Badge className={enumBadgeClass(enumValue)} variant="secondary">
				{enumLabel(enumValue)}
			</Badge>
		);
	}
	return String(value);
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat("en", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(new Date(value));
}

function enumLabel(value: string): string {
	return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function enumBadgeClass(value: string): string {
	const classes = [
		"border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
		"border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
		"border-transparent bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
		"border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
		"border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
		"border-transparent bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
	];
	return classes[hashString(value) % classes.length] ?? classes[0];
}

function hashString(value: string): number {
	let hash = 0;
	for (const character of value) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}
	return hash;
}

function columnSize(column: TableColumnInfo): number {
	if (column.id === "id") {
		return 80;
	}
	if (column.kind === "date") {
		return 176;
	}
	if (column.id === "email") {
		return 240;
	}
	if (column.id === "phone") {
		return 168;
	}
	if (column.id === "notes") {
		return 320;
	}
	return 144;
}

function cellClassName(column: TableColumnInfo, index: number): string {
	const classes = ["px-3"];
	if (index === 0) {
		classes.push("separator-r", "font-medium");
	}
	if (column.id === "notes") {
		classes.push("text-muted-foreground");
	}
	return classes.join(" ");
}

function headClassName(index: number): string {
	const classes = ["px-3", "text-muted-foreground"];
	if (index === 0) {
		classes.push("separator-r");
	}
	return classes.join(" ");
}

function titleLabel(value: string): string {
	return value
		.replace(/^_+/, "")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(" ")
		.map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}
