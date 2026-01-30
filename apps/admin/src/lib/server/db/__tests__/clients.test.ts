import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { benchmarkDb, grammarDb } from "../index";

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
