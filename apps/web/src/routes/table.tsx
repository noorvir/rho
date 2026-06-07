import {
	IconAdjustmentsHorizontal,
	IconBookmark,
	IconChevronDown,
	IconFilter,
	IconLink,
	IconX,
} from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { loadTable, type TableColumnInfo, type TableData, type TableRow } from "@/table-client";

const tableName = "contacts";

export function TablePage() {
	const [table, setTable] = useState<TableData>();
	const [error, setError] = useState<string | undefined>();
	const [loading, setLoading] = useState(true);
	const columns = useMemo(() => (table ? dataColumns(table.columns) : []), [table]);
	const rows = table?.rows ?? [];

	useEffect(() => {
		let cancelled = false;

		loadTable(tableName)
			.then((nextTable) => {
				if (!cancelled) {
					setTable(nextTable);
					setError(undefined);
				}
			})
			.catch((nextError: unknown) => {
				if (!cancelled) {
					setError(nextError instanceof Error ? nextError.message : "Failed to load table");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="h-dvh bg-background p-3 text-foreground">
			<DataTableSurface className="reference-table-wide h-full">
				<DataTableToolbar>
					<div className="flex items-center gap-3">
						<Input
							aria-label="Search"
							className="h-7 w-56 border-0 bg-muted text-sm shadow-none focus-visible:ring-0"
							placeholder={`Search ${tableName}`}
						/>
						<Button className="h-7 gap-2 px-2 text-sm" type="button" variant="ghost">
							<IconFilter className="size-3.5" />
							Table
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
						<span className="px-2">Loaded from</span>
						<ChipSeparator />
						<span className="px-2 font-medium text-foreground">SQLite {tableName}</span>
						<ChipSeparator />
						<button className="inline-flex h-full items-center gap-1 px-2" type="button">
							{rows.length} rows
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
						<GroupRow count={rows.length} />
					</DataTableScroll>

					<DataTableRail />
				</div>
			</DataTableSurface>
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
