import { count } from "drizzle-orm";
import { benchmarkDb, benchmarkQueries, grammarDb, grammarPoints } from "$lib/server/db";

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
