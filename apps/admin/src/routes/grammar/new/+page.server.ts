import { redirect } from "@sveltejs/kit";
import { grammarDb, grammarPoints, levels } from "$lib/server/db";

export async function load() {
	const allLevels = grammarDb
		.select({ id: levels.id, code: levels.code, name: levels.name })
		.from(levels)
		.all();

	return { levels: allLevels };
}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();

		const result = grammarDb
			.insert(grammarPoints)
			.values({
				slug: data.get("slug") as string,
				japanese: data.get("japanese") as string,
				romaji: (data.get("romaji") as string) || null,
				meaning: data.get("meaning") as string,
				levelId: data.get("levelId") ? Number(data.get("levelId")) : null,
				category: (data.get("category") as string) || null,
				formation: (data.get("formation") as string) || null,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({ id: grammarPoints.id })
			.get();

		redirect(303, `/grammar/${result.id}`);
	},
};
