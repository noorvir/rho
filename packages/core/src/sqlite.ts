import { type Client, createClient } from "@libsql/client/node";

export type RhoDatabase = Client;

export function createRhoDatabase(databaseUrl: string): RhoDatabase {
	return createClient({ url: databaseUrl });
}
