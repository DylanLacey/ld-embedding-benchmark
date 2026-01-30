import { error, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { examples, grammarDb, grammarPoints, levels } from "$lib/server/db";

export async function load({ params }) {
	const point = grammarDb
		.select()
		.from(grammarPoints)
		.where(eq(grammarPoints.id, Number(params.id)))
		.get();

	if (!point) {
		throw error(404, "Grammar point not found");
	}

	const pointExamples = grammarDb
		.select()
		.from(examples)
		.where(eq(examples.grammarPointId, point.id))
		.all();

	const allLevels = grammarDb
		.select({ id: levels.id, code: levels.code, name: levels.name })
		.from(levels)
		.all();

	return { point, examples: pointExamples, levels: allLevels };
}

export const actions = {
	update: async ({ params, request }) => {
		const data = await request.formData();

		grammarDb
			.update(grammarPoints)
			.set({
				slug: data.get("slug") as string,
				japanese: data.get("japanese") as string,
				romaji: (data.get("romaji") as string) || null,
				meaning: data.get("meaning") as string,
				levelId: data.get("levelId") ? Number(data.get("levelId")) : null,
				category: (data.get("category") as string) || null,
				formation: (data.get("formation") as string) || null,
				updatedAt: new Date(),
			})
			.where(eq(grammarPoints.id, Number(params.id)))
			.run();

		return { success: true };
	},

	delete: async ({ params }) => {
		grammarDb
			.delete(grammarPoints)
			.where(eq(grammarPoints.id, Number(params.id)))
			.run();
		throw redirect(303, "/grammar");
	},
};
