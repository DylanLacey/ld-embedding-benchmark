import { count } from "drizzle-orm";
import { benchmarkDb, benchmarkExpected, benchmarkQueries } from "$lib/server/db";

export async function load() {
	const queries = benchmarkDb.select().from(benchmarkQueries).all();

	const expectedCounts = benchmarkDb
		.select({
			queryId: benchmarkExpected.queryId,
			count: count(),
		})
		.from(benchmarkExpected)
		.groupBy(benchmarkExpected.queryId)
		.all();

	const countMap = new Map(expectedCounts.map((e) => [e.queryId, e.count]));

	const queriesWithCounts = queries.map((q) => ({
		...q,
		expectedCount: countMap.get(q.id) ?? 0,
	}));

	return { queries: queriesWithCounts };
}
