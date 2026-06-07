const defaultServerUrl = "http://127.0.0.1:7331";

export type TableValueKind = "boolean" | "date" | "enum" | "number" | "text";
export type TableValue = null | string | number | boolean;
export type TableRow = Record<string, TableValue>;

export interface TableColumnInfo {
	id: string;
	label: string;
	kind: TableValueKind;
	declaredType: string;
	nullable: boolean;
	primaryKey: boolean;
	defaultValue: TableValue;
}

export interface TableData {
	name: string;
	columns: TableColumnInfo[];
	rows: TableRow[];
	limit: number;
	offset: number;
}

export async function loadTable(name: string): Promise<TableData> {
	const response = await fetch(tableUrl(`/tables/${name}`), {
		headers: authHeaders(),
	});
	if (!response.ok) {
		throw new Error(await responseError(response, `Failed to load ${name}`));
	}

	return (await response.json()) as TableData;
}

function tableUrl(path: string): string {
	const baseUrl = import.meta.env.VITE_RHO_SERVER_URL || defaultServerUrl;
	return new URL(path, baseUrl).toString();
}

function authHeaders(): HeadersInit {
	const secret = import.meta.env.VITE_RHO_API_SECRET;
	return secret ? { Authorization: `Bearer ${secret}` } : {};
}

async function responseError(response: Response, fallback: string): Promise<string> {
	const body = await response.text();
	return body
		? `${fallback}: HTTP ${response.status} ${body}`
		: `${fallback}: HTTP ${response.status}`;
}
