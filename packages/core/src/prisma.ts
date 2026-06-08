import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/prisma/client.ts";

export type RhoPrisma = PrismaClient;

export function createRhoPrisma(databaseUrl: string): RhoPrisma {
	return new PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });
}
