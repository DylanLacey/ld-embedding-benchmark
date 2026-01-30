import { error, redirect } from "@sveltejs/kit";
import { eq, like, or } from "drizzle-orm";
import {
	benchmarkDb,
	benchmarkExpected,
	benchmarkQueries,
	grammarDb,
	grammarPoints,
	levels,
} from "$lib/server/db";

export async function load({ params, url }) {
	const query = benchmarkDb
		.select()
		.from(benchmarkQueries)
		.where(eq(benchmarkQueries.id, Number(params.id)))
		.get();

	if (!query) {
		throw error(404, "Query not found");
	}

	const search = url.searchParams.get("q") ?? "";

	let pointsQuery = grammarDb
		.select({
			id: grammarPoints.id,
			japanese: grammarPoints.japanese,
			romaji: grammarPoints.romaji,
			meaning: grammarPoints.meaning,
			levelCode: levels.code,
		})
		.from(grammarPoints)
		.leftJoin(levels, eq(grammarPoints.levelId, levels.id))
		.$dynamic();

	if (search) {
		pointsQuery = pointsQuery.where(
			or(
				like(grammarPoints.japanese, `%${search}%`),
				like(grammarPoints.romaji, `%${search}%`),
				like(grammarPoints.meaning, `%${search}%`),
			),
		);
	}

	const points = pointsQuery.limit(50).all();

	const allLevels = grammarDb
		.select({ id: levels.id, code: levels.code, name: levels.name })
		.from(levels)
		.all();

	return { query, points, levels: allLevels, search };
}

export const actions = {
	add: async ({ params, request }) => {
		const data = await request.formData();
		const grammarPointId = Number(data.get("grammarPointId"));
		const relevanceScore = data.get("relevanceScore") ? Number(data.get("relevanceScore")) : null;

		benchmarkDb
			.insert(benchmarkExpected)
			.values({
				queryId: Number(params.id),
				grammarPointId,
				relevanceScore,
			})
			.run();

		throw redirect(303, `/queries/${params.id}`);
	},
};
