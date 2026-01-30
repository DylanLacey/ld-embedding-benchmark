import { eq, like, or } from "drizzle-orm";
import { grammarDb, grammarPoints, languages, levels } from "$lib/server/db";

export async function load({ url }) {
	const search = url.searchParams.get("q") ?? "";

	let query = grammarDb
		.select({
			id: grammarPoints.id,
			slug: grammarPoints.slug,
			japanese: grammarPoints.japanese,
			romaji: grammarPoints.romaji,
			meaning: grammarPoints.meaning,
			category: grammarPoints.category,
			levelCode: levels.code,
			languageCode: languages.code,
		})
		.from(grammarPoints)
		.leftJoin(levels, eq(grammarPoints.levelId, levels.id))
		.leftJoin(languages, eq(levels.languageId, languages.id))
		.$dynamic();

	if (search) {
		query = query.where(
			or(
				like(grammarPoints.japanese, `%${search}%`),
				like(grammarPoints.romaji, `%${search}%`),
				like(grammarPoints.meaning, `%${search}%`),
			),
		);
	}

	const points = query.orderBy(grammarPoints.japanese).all();

	const allLevels = grammarDb
		.select({ id: levels.id, code: levels.code, name: levels.name })
		.from(levels)
		.all();

	return { points, levels: allLevels, search };
}
