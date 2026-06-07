import type { Row, Value } from "@libsql/client/node";
import { sqlite } from "./sqlite.ts";

type TableValueKind = "boolean" | "date" | "enum" | "number" | "text";
type JsonScalar = null | string | number | boolean;
export type TableRow = Record<string, JsonScalar>;

export interface TableSummary {
	name: string;
	label: string;
}

interface TableInfoRow {
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: Value;
	pk: number;
}

export interface TableColumnInfo {
	id: string;
	label: string;
	kind: TableValueKind;
	declaredType: string;
	nullable: boolean;
	primaryKey: boolean;
	defaultValue: JsonScalar;
}

export interface TableData {
	name: string;
	columns: TableColumnInfo[];
	rows: TableRow[];
	limit: number;
	offset: number;
}

interface TableOptions {
	limit?: number;
	offset?: number;
	orderBy?: string;
	order?: string;
}

const defaultLimit = 100;
const maxLimit = 500;

export async function getTables(): Promise<TableSummary[]> {
	const result = await sqlite.execute(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name",
	);

	return result.rows.map((row) => {
		const name = String(row.name);
		return { name, label: titleLabel(name) };
	});
}

export async function getTableData(
	name: string,
	options: TableOptions = {},
): Promise<TableData | undefined> {
	if (!(await tableExists(name))) {
		return undefined;
	}

	const tableInfo = await getTableInfo(name);
	const limit = clampLimit(options.limit);
	const offset = Math.max(0, options.offset ?? 0);

	return {
		name,
		columns: tableInfo.map(tableColumn),
		rows: await tableRows(name, tableInfo, {
			limit,
			offset,
			orderBy: validColumnName(tableInfo, options.orderBy) ? options.orderBy : undefined,
			order: options.order?.toLowerCase() === "desc" ? "desc" : "asc",
		}),
		limit,
		offset,
	};
}

async function tableExists(name: string): Promise<boolean> {
	const result = await sqlite.execute({
		sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? AND name NOT LIKE 'sqlite_%'",
		args: [name],
	});
	return result.rows.length > 0;
}

async function getTableInfo(table: string): Promise<TableInfoRow[]> {
	const result = await sqlite.execute(`PRAGMA table_info(${quoteIdentifier(table)})`);
	return result.rows.map(tableInfoRow);
}

async function tableRows(
	table: string,
	columns: TableInfoRow[],
	options: { limit: number; offset: number; order: "asc" | "desc"; orderBy?: string },
): Promise<TableRow[]> {
	const orderClause = options.orderBy
		? `ORDER BY ${quoteIdentifier(options.orderBy)} ${options.order.toUpperCase()}`
		: "";
	const result = await sqlite.execute({
		sql: `SELECT * FROM ${quoteIdentifier(table)} ${orderClause} LIMIT ? OFFSET ?`,
		args: [options.limit, options.offset],
	});

	return result.rows.map((row) => rowObject(row, columns));
}

function tableColumn(column: TableInfoRow): TableColumnInfo {
	return {
		id: column.name,
		label: titleLabel(column.name),
		kind: columnKind(column.type),
		declaredType: column.type,
		nullable: column.notnull === 0,
		primaryKey: column.pk > 0,
		defaultValue: jsonValue(column.dflt_value, column.type),
	};
}

function rowObject(row: Row, columns: TableInfoRow[]): TableRow {
	const value: TableRow = {};
	for (const column of columns) {
		value[column.name] = jsonValue(row[column.name], column.type);
	}
	return value;
}

function tableInfoRow(row: Row): TableInfoRow {
	return {
		cid: Number(row.cid),
		name: String(row.name),
		type: String(row.type),
		notnull: Number(row.notnull),
		dflt_value: row.dflt_value,
		pk: Number(row.pk),
	};
}

function jsonValue(value: Value, declaredType: string): JsonScalar {
	if (value === null) {
		return null;
	}
	if (columnKind(declaredType) === "boolean") {
		return value === 1 || value === "1" || value === "true";
	}
	if (typeof value === "bigint") {
		return Number(value);
	}
	if (value instanceof ArrayBuffer) {
		return "[blob]";
	}
	return value;
}

function columnKind(declaredType: string): TableValueKind {
	const type = declaredType.toUpperCase();
	if (type.includes("BOOL")) {
		return "boolean";
	}
	if (type.includes("DATE") || type.includes("TIME")) {
		return "date";
	}
	if (
		type.includes("INT") ||
		type.includes("REAL") ||
		type.includes("FLOA") ||
		type.includes("DOUB")
	) {
		return "number";
	}
	if (isTextType(type) || type === "") {
		return "text";
	}
	return "enum";
}

function isTextType(type: string): boolean {
	return (
		type.includes("CHAR") ||
		type.includes("CLOB") ||
		type.includes("TEXT") ||
		type.includes("VARCHAR")
	);
}

function clampLimit(limit: number | undefined): number {
	if (!limit) {
		return defaultLimit;
	}
	return Math.min(Math.max(1, limit), maxLimit);
}

function validColumnName(columns: TableInfoRow[], name: string | undefined): name is string {
	return Boolean(name && columns.some((column) => column.name === name));
}

function titleLabel(value: string): string {
	return value
		.replace(/^_+/, "")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(" ")
		.map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

function quoteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}
