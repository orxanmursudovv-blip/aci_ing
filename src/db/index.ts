import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB };

export function createDb(url: string): DB {
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

export function getDb(): DB {
  if (!globalForDb.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL təyin edilməyib");
    globalForDb.__db = createDb(url);
  }
  return globalForDb.__db;
}
