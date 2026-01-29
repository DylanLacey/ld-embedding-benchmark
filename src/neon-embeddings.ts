// src/neon-embeddings.ts
// Operations for storing and searching grammar embeddings in Neon/pgvector
// Where meaning becomes geometry, and geometry becomes findable

import type { NeonClient } from "./neon.js";

export interface GrammarEmbeddingSource {
	grammarPointId: number;
	sourceType: "name_meaning" | "example" | "formation";
	sourceText: string;
}

/**
 * Stores a single embedding in the vector vault.
 * Upserts on conflict — fresh vectors overwrite stale ones.
 */
export async function storeEmbedding(
	sql: NeonClient,
	source: GrammarEmbeddingSource,
	modelId: string,
	embedding: number[],
): Promise<void> {
	const embeddingStr = `[${embedding.join(",")}]`;
	await sql`
    INSERT INTO grammar_embeddings (grammar_point_id, model_id, source_type, source_text, embedding)
    VALUES (${source.grammarPointId}, ${modelId}, ${source.sourceType}, ${source.sourceText}, ${embeddingStr}::vector)
    ON CONFLICT (grammar_point_id, model_id, source_type, source_text) DO UPDATE SET
      embedding = ${embeddingStr}::vector
  `;
}

/**
 * Stores multiple embeddings in sequence.
 * Not the most glamorous batch operation, but reliable.
 * TODO: consider proper bulk insert when datasets grow teeth.
 */
export async function storeEmbeddingsBatch(
	sql: NeonClient,
	sources: GrammarEmbeddingSource[],
	modelId: string,
	embeddings: number[][],
): Promise<void> {
	if (sources.length !== embeddings.length) {
		throw new Error(
			`Mismatched arrays: ${sources.length} sources but ${embeddings.length} embeddings`,
		);
	}
	for (let i = 0; i < sources.length; i++) {
		const source = sources[i];
		const embedding = embeddings[i];
		if (source && embedding) {
			await storeEmbedding(sql, source, modelId, embedding);
		}
	}
}

export interface SearchResult {
	grammarPointId: number;
	japanese: string;
	meaning: string;
	level: string;
	sourceType: string;
	similarity: number;
}

/**
 * Finds grammar points whose embeddings resemble the query vector.
 * Returns the best match per grammar point, sorted by semantic affinity.
 *
 * The <=> operator is pgvector's cosine distance; we flip it to similarity.
 */
export async function searchSimilar(
	sql: NeonClient,
	queryEmbedding: number[],
	modelId: string,
	limit = 10,
): Promise<SearchResult[]> {
	const embeddingStr = `[${queryEmbedding.join(",")}]`;

	// Get best match per grammar point via DISTINCT ON
	// Neon returns Record<string, unknown>[], so we validate shape at runtime.
	const rawResults = await sql`
    SELECT DISTINCT ON (gp.id)
      gp.id as grammar_point_id,
      gp.japanese,
      gp.meaning,
      gp.level,
      ge.source_type,
      1 - (ge.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM grammar_embeddings ge
    JOIN grammar_points gp ON gp.id = ge.grammar_point_id
    WHERE ge.model_id = ${modelId}
    ORDER BY gp.id, similarity DESC
  `;
	const results: SearchResult[] = (rawResults as Array<Record<string, unknown>>).map((row) => ({
		grammarPointId: Number(row.grammar_point_id),
		japanese: String(row.japanese ?? ""),
		meaning: String(row.meaning ?? ""),
		level: String(row.level ?? ""),
		sourceType: String(row.source_type ?? ""),
		similarity: Number(row.similarity ?? 0),
	}));

	// DISTINCT ON ordered by gp.id; we need final sort by similarity
	return results
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, limit);
}

/**
 * Counts embeddings for a given model.
 * Useful for progress bars and existential queries.
 */
export async function getEmbeddingCount(
	sql: NeonClient,
	modelId: string,
): Promise<number> {
	const results = (await sql`
    SELECT COUNT(*) as count FROM grammar_embeddings WHERE model_id = ${modelId}
  `) as Array<Record<string, unknown>>;
	const result = results[0];
	return result ? Number(result.count ?? 0) : 0;
}

/**
 * Removes all embeddings for a model.
 * A clean slate, a fresh start, a tabula rasa of vectors.
 */
export async function deleteEmbeddings(
	sql: NeonClient,
	modelId: string,
): Promise<void> {
	await sql`DELETE FROM grammar_embeddings WHERE model_id = ${modelId}`;
}
