import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface ExtensionPackageManifest {
	extensions: string[];
}

export async function readExtensionPackageManifest(
	directory: string,
): Promise<ExtensionPackageManifest | undefined> {
	try {
		const content = await readFile(join(directory, "package.json"), "utf8");
		const data = JSON.parse(content) as unknown;
		const rho = readRecord(data)?.rho;
		const extensions = readRecord(rho)?.extensions;
		if (!Array.isArray(extensions)) {
			return undefined;
		}

		const paths = extensions.filter((value): value is string => typeof value === "string");
		return paths.length > 0
			? { extensions: paths.map((entry) => resolve(directory, entry)) }
			: undefined;
	} catch {
		return undefined;
	}
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}
