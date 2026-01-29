// src/seed-queries.ts
import { openBenchmarkDatabase } from "./benchmark-db.js";

interface SeedQuery {
  queryText: string;
  queryLanguage: string;
  targetLanguage: string;
  difficulty: "direct" | "descriptive" | "situational" | "adversarial";
  isRanked: boolean;
  expected: Array<{ grammarPointId: number; relevance?: number }>;
}

// Sample queries for Japanese conditionals
// Grammar point IDs reference Neon grammar_points table
const SEED_QUERIES: SeedQuery[] = [
  // Direct queries (use grammatical terminology)
  {
    queryText: "What is the conditional form in Japanese?",
    queryLanguage: "en",
    targetLanguage: "ja",
    difficulty: "direct",
    isRanked: false,
    expected: [
      { grammarPointId: 1 }, // と
      { grammarPointId: 2 }, // ば
      { grammarPointId: 3 }, // たら
      { grammarPointId: 4 }, // なら
    ],
  },
  // Descriptive queries (describe meaning without jargon)
  {
    queryText: "How do I say 'if it rains tomorrow' in Japanese?",
    queryLanguage: "en",
    targetLanguage: "ja",
    difficulty: "descriptive",
    isRanked: true,
    expected: [
      { grammarPointId: 3, relevance: 3 }, // たら - best for hypothetical future
      { grammarPointId: 2, relevance: 2 }, // ば
      { grammarPointId: 1, relevance: 1 }, // と
    ],
  },
  // Situational queries (contextual, no explicit grammar mention)
  {
    queryText: "I want to tell my friend what happens when I press this button",
    queryLanguage: "en",
    targetLanguage: "ja",
    difficulty: "situational",
    isRanked: true,
    expected: [
      { grammarPointId: 1, relevance: 3 }, // と - natural result
      { grammarPointId: 2, relevance: 2 }, // ば
    ],
  },
];

export function seedBenchmarkQueries(options: { force?: boolean } = {}): void {
  const db = openBenchmarkDatabase();

  try {
    // Check for existing data—idempotency matters
    const existing = db.prepare("SELECT COUNT(*) as count FROM benchmark_queries").get() as { count: number };
    if (existing.count > 0 && !options.force) {
      console.log(`Found ${existing.count} existing queries. Use --force to re-seed (will add duplicates).`);
      db.close();
      return;
    }

    const insertQuery = db.prepare(`
      INSERT INTO benchmark_queries (query_text, query_language, target_language, difficulty, is_ranked)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertExpected = db.prepare(`
      INSERT INTO benchmark_expected (query_id, grammar_point_id, relevance_score)
      VALUES (?, ?, ?)
    `);

    db.transaction(() => {
      for (const q of SEED_QUERIES) {
        const result = insertQuery.run(
          q.queryText,
          q.queryLanguage,
          q.targetLanguage,
          q.difficulty,
          q.isRanked ? 1 : 0
        );

        const queryId = Number(result.lastInsertRowid);

        for (const exp of q.expected) {
          insertExpected.run(queryId, exp.grammarPointId, exp.relevance ?? null);
        }
      }
    })();

    console.log(`Seeded ${SEED_QUERIES.length} benchmark queries`);
  } finally {
    db.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedBenchmarkQueries();
}
