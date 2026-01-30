import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { grammarDb, benchmarkDb } from "../index";

describe("Database clients", () => {
	it("connects to grammar.db", () => {
		const result = grammarDb.get(sql`SELECT 1 as value`);
		expect(result).toEqual({ value: 1 });
	});

	it("connects to benchmark.db", () => {
		const result = benchmarkDb.get(sql`SELECT 1 as value`);
		expect(result).toEqual({ value: 1 });
	});
});
