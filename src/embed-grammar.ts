// src/embed-grammar.ts
// The grand vectorisation ceremony—where grammar constructs become points in semantic space
import { createNeonClient } from "./neon.js";
import { setupEmbeddingsSchema } from "./neon-schema.js";
import { createModelInstance } from "./embeddings/index.js";
import {
	storeEmbedding,
	getEmbeddingCount,
	deleteEmbeddings,
} from "./neon-embeddings.js";
import type { GrammarEmbeddingSource } from "./neon-embeddings.js";
import ora from "ora";

export interface EmbedOptions {
	modelId: string;
	branchUrl?: string;
	force?: boolean;
}

interface EmbedResult {
	embedded: number;
	skipped: number;
}

/**
 * Embeds all grammar constructs into vector space.
 * Each grammar point contributes multiple vectors: name+meaning, formation, and examples.
 * Think of it as giving each grammar point a constellation of semantic coordinates.
 */
export async function embedGrammarConstructs(
	options: EmbedOptions,
): Promise<EmbedResult> {
	const { modelId, branchUrl, force } = options;
	const spinner = ora("Initialising...").start();

	const sql = createNeonClient(branchUrl);
	const model = createModelInstance({ modelId });

	try {
		// Setup embeddings schema with correct dimensions
		spinner.text = "Setting up embeddings schema...";
		await setupEmbeddingsSchema(sql, model.dimensions);

		// Check existing embeddings—are we treading on old vectors?
		const existingCount = await getEmbeddingCount(sql, modelId);
		if (existingCount > 0 && !force) {
			spinner.info(
				`Found ${existingCount} existing embeddings for ${modelId}. Use --force to re-embed.`,
			);
			return { embedded: 0, skipped: existingCount };
		}

		if (force && existingCount > 0) {
			spinner.text = "Deleting existing embeddings...";
			await deleteEmbeddings(sql, modelId);
		}

		// Fetch all grammar points
		spinner.text = "Fetching grammar points...";
		const grammarPoints = (await sql`
			SELECT id, slug, japanese, romaji, meaning, formation
			FROM grammar_points
			ORDER BY id
		`) as Array<{
			id: number;
			slug: string;
			japanese: string;
			romaji: string | null;
			meaning: string;
			formation: string | null;
		}>;

		// Fetch all examples
		const examples = (await sql`
			SELECT grammar_point_id, japanese, english
			FROM examples
			ORDER BY grammar_point_id, id
		`) as Array<{
			grammar_point_id: number;
			japanese: string;
			english: string;
		}>;

		// Group examples by grammar point—each point gathers its flock
		const examplesByGrammar = new Map<
			number,
			Array<{ japanese: string; english: string }>
		>();
		for (const ex of examples) {
			const list = examplesByGrammar.get(ex.grammar_point_id) ?? [];
			list.push({ japanese: ex.japanese, english: ex.english });
			examplesByGrammar.set(ex.grammar_point_id, list);
		}

		// Generate embedding sources—the raw material for vectorisation
		const sources: GrammarEmbeddingSource[] = [];

		for (const gp of grammarPoints) {
			// Name + meaning: the grammar point's calling card
			sources.push({
				grammarPointId: gp.id,
				sourceType: "name_meaning",
				sourceText: `${gp.japanese} - ${gp.meaning}`,
			});

			// Formation: the structural blueprint (if it exists)
			if (gp.formation) {
				sources.push({
					grammarPointId: gp.id,
					sourceType: "formation",
					sourceText: gp.formation,
				});
			}

			// Examples: where grammar goes to show its moves
			const gpExamples = examplesByGrammar.get(gp.id) ?? [];
			for (const ex of gpExamples) {
				sources.push({
					grammarPointId: gp.id,
					sourceType: "example",
					sourceText: ex.japanese,
				});
			}
		}

		// Embed and store—the main event
		let embedded = 0;
		const batchSize = 10;

		for (let i = 0; i < sources.length; i += batchSize) {
			const batch = sources.slice(i, i + batchSize);
			spinner.text = `Embedding ${i + batch.length}/${sources.length}...`;

			const texts = batch.map((s) => s.sourceText);
			const embeddings = await model.embedBatch(texts, "document");

			for (let j = 0; j < batch.length; j++) {
				const source = batch[j];
				const embedding = embeddings[j];
				if (source && embedding) {
					await storeEmbedding(sql, source, modelId, embedding);
					embedded++;
				}
			}
		}

		spinner.succeed(`Embedded ${embedded} vectors for ${modelId}`);
		return { embedded, skipped: 0 };
	} catch (error) {
		spinner.fail("Embedding failed");
		throw error;
	}
}
