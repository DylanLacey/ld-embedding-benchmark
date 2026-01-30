import { grammarDb, benchmarkDb, grammarPoints, benchmarkQueries } from "$lib/server/db";
import { count } from "drizzle-orm";

export async function load() {
	const [grammarCount] = grammarDb.select({ count: count() }).from(grammarPoints).all();
	const [queryCount] = benchmarkDb.select({ count: count() }).from(benchmarkQueries).all();
	const levelCounts = grammarDb
		.select({ levelId: grammarPoints.levelId, count: count() })
		.from(grammarPoints)
		.groupBy(grammarPoints.levelId)
		.all();

	return {
		stats: {
			grammarPoints: grammarCount?.count ?? 0,
			queries: queryCount?.count ?? 0,
			byLevel: levelCounts,
		},
	};
}
