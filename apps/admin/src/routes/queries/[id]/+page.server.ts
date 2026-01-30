import { error, redirect } from '@sveltejs/kit';
import {
	benchmarkDb,
	benchmarkQueries,
	benchmarkExpected,
	grammarDb,
	grammarPoints,
} from '$lib/server/db';
import { eq } from 'drizzle-orm';

export async function load({ params }) {
	const query = benchmarkDb
		.select()
		.from(benchmarkQueries)
		.where(eq(benchmarkQueries.id, Number(params.id)))
		.get();

	if (!query) {
		throw error(404, 'Query not found');
	}

	const expected = benchmarkDb
		.select()
		.from(benchmarkExpected)
		.where(eq(benchmarkExpected.queryId, query.id))
		.all();

	const grammarPointIds = expected.map((e) => e.grammarPointId);
	const points =
		grammarPointIds.length > 0 ? grammarDb.select().from(grammarPoints).all() : [];
	const pointMap = new Map(points.map((p) => [p.id, p]));

	const expectedWithDetails = expected.map((e) => ({
		...e,
		grammarPoint: pointMap.get(e.grammarPointId),
	}));

	return { query, expected: expectedWithDetails };
}

export const actions = {
	update: async ({ params, request }) => {
		const data = await request.formData();

		benchmarkDb
			.update(benchmarkQueries)
			.set({
				queryText: data.get('queryText') as string,
				queryLanguage: (data.get('queryLanguage') as string) || null,
				targetLanguage: (data.get('targetLanguage') as string) || null,
				difficulty: (data.get('difficulty') as string) || null,
				isRanked: data.get('isRanked') === 'on',
				updatedAt: new Date(),
			})
			.where(eq(benchmarkQueries.id, Number(params.id)))
			.run();

		return { success: true };
	},

	delete: async ({ params }) => {
		benchmarkDb
			.delete(benchmarkQueries)
			.where(eq(benchmarkQueries.id, Number(params.id)))
			.run();
		throw redirect(303, '/queries');
	},

	removeExpected: async ({ request }) => {
		const data = await request.formData();
		const expectedId = Number(data.get('expectedId'));
		benchmarkDb.delete(benchmarkExpected).where(eq(benchmarkExpected.id, expectedId)).run();
		return { success: true };
	},
};
