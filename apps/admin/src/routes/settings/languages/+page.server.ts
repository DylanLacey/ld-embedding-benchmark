import { eq } from "drizzle-orm";
import { grammarDb, languages, levels } from "$lib/server/db";

export async function load() {
	const allLanguages = grammarDb.select().from(languages).all();
	const allLevels = grammarDb.select().from(levels).orderBy(levels.sortOrder).all();

	const languagesWithLevels = allLanguages.map((lang) => ({
		...lang,
		levels: allLevels.filter((l) => l.languageId === lang.id),
	}));

	return { languages: languagesWithLevels };
}

export const actions = {
	addLanguage: async ({ request }) => {
		const data = await request.formData();
		grammarDb
			.insert(languages)
			.values({
				code: data.get("code") as string,
				name: data.get("name") as string,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.run();
		return { success: true };
	},

	addLevel: async ({ request }) => {
		const data = await request.formData();
		grammarDb
			.insert(levels)
			.values({
				languageId: Number(data.get("languageId")),
				code: data.get("code") as string,
				name: data.get("name") as string,
				sortOrder: data.get("sortOrder") ? Number(data.get("sortOrder")) : null,
			})
			.run();
		return { success: true };
	},

	deleteLevel: async ({ request }) => {
		const data = await request.formData();
		grammarDb
			.delete(levels)
			.where(eq(levels.id, Number(data.get("levelId"))))
			.run();
		return { success: true };
	},
};
