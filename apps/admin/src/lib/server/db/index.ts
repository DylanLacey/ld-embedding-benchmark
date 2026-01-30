import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as benchmarkSchema from "./schema/benchmark";
import * as grammarSchema from "./schema/grammar";

const DATA_DIR = resolve(import.meta.dirname, "../../../../../../data");

const grammarSqlite = new Database(process.env.GRAMMAR_DB_PATH ?? resolve(DATA_DIR, "grammar.db"));
const benchmarkSqlite = new Database(
	process.env.BENCHMARK_DB_PATH ?? resolve(DATA_DIR, "benchmark.db"),
);

export const grammarDb = drizzle(grammarSqlite, { schema: grammarSchema });
export const benchmarkDb = drizzle(benchmarkSqlite, { schema: benchmarkSchema });

export * from "./schema/benchmark";
export * from "./schema/grammar";
