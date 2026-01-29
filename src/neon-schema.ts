// src/neon-schema.ts
import type { NeonClient } from "./neon.js";

/**
 * Sets up the grammar schema — the bedrock upon which our linguistic treasures rest.
 * Creates tables for grammar points and their accompanying examples.
 */
export async function setupGrammarSchema(sql: NeonClient): Promise<void> {
	// Enable pgvector extension — vectors need a home too
	await sql`CREATE EXTENSION IF NOT EXISTS vector`;

	// Grammar points table
	await sql`
    CREATE TABLE IF NOT EXISTS grammar_points (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      japanese TEXT NOT NULL,
      romaji TEXT,
      meaning TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      detail_url TEXT,
      formation TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

	// Examples table — where grammar goes to show off
	await sql`
    CREATE TABLE IF NOT EXISTS examples (
      id SERIAL PRIMARY KEY,
      grammar_point_id INTEGER NOT NULL REFERENCES grammar_points(id) ON DELETE CASCADE,
      japanese TEXT NOT NULL,
      english TEXT NOT NULL,
      source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

	// Create indexes for the queries we'll actually run
	await sql`CREATE INDEX IF NOT EXISTS idx_examples_grammar_id ON examples(grammar_point_id)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_grammar_level ON grammar_points(level)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_grammar_category ON grammar_points(category)`;
}

/**
 * Sets up the embeddings schema — where meaning becomes geometry.
 * Vector dimensions vary by model, hence the parameter.
 */
export async function setupEmbeddingsSchema(
	sql: NeonClient,
	dimensions: number,
): Promise<void> {
	// Grammar embeddings table — dimension varies by model's notion of semantic space
	await sql`
    CREATE TABLE IF NOT EXISTS grammar_embeddings (
      id SERIAL PRIMARY KEY,
      grammar_point_id INTEGER NOT NULL REFERENCES grammar_points(id) ON DELETE CASCADE,
      model_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_text TEXT NOT NULL,
      embedding vector(${dimensions}),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(grammar_point_id, model_id, source_type, source_text)
    )
  `;

	// IVFFlat index for approximate nearest neighbour search
	// 100 lists is a decent starting point for small-to-medium datasets
	await sql`
    CREATE INDEX IF NOT EXISTS idx_embeddings_vector
    ON grammar_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

	await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_model ON grammar_embeddings(model_id)`;
}
