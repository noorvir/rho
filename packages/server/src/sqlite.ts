import { createClient } from "@libsql/client/node";

const databaseUrl = process.env.DATABASE_URL ?? new URL("../dev.db", import.meta.url).href;

export const sqlite = createClient({ url: databaseUrl });
