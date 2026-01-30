import { redirect } from "@sveltejs/kit";
import { benchmarkDb, benchmarkQueries } from "$lib/server/db";

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();

		const result = benchmarkDb
			.insert(benchmarkQueries)
			.values({
				queryText: data.get("queryText") as string,
				queryLanguage: (data.get("queryLanguage") as string) || null,
				targetLanguage: (data.get("targetLanguage") as string) || null,
				difficulty: (data.get("difficulty") as string) || null,
				isRanked: data.get("isRanked") === "on",
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({ id: benchmarkQueries.id })
			.get();

		throw redirect(303, `/queries/${result.id}`);
	},
};
