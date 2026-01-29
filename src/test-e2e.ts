// src/test-e2e.ts
// The alchemical verification ritual—prove the system works end-to-end
// or produce a helpful diagnostic when it doesn't

import { createNeonClient } from "./neon.js";
import { openBenchmarkDatabase } from "./benchmark-db.js";
import { createModelInstance, MODEL_REGISTRY } from "./embeddings/index.js";
import { searchSimilar, getEmbeddingCount } from "./neon-embeddings.js";
import pc from "picocolors";

async function runE2ETest(): Promise<void> {
  console.log(pc.cyan("\n--- Running end-to-end test ---\n"));

  // 1. Test Neon connection
  console.log(pc.yellow("1. Testing Neon connection..."));
  const sql = createNeonClient();
  const testResults = (await sql`SELECT 1 as test`) as Array<
    Record<string, unknown>
  >;
  if (testResults.length === 0 || testResults[0]?.test !== 1) {
    throw new Error("Neon connection test query returned unexpected result");
  }
  console.log(pc.green("   [ok] Neon connection established"));

  // 2. Test grammar data exists
  console.log(pc.yellow("2. Checking grammar data..."));
  const countResults = (await sql`SELECT COUNT(*) as count FROM grammar_points`) as Array<
    Record<string, unknown>
  >;
  const grammarCount = Number(countResults[0]?.count ?? 0);
  console.log(pc.green(`   [ok] Found ${grammarCount} grammar points`));

  // 3. Test SQLite benchmark DB
  console.log(pc.yellow("3. Testing benchmark database..."));
  const benchDb = openBenchmarkDatabase();
  const queryCount = benchDb
    .prepare("SELECT COUNT(*) as count FROM benchmark_queries")
    .get() as { count: number };
  console.log(pc.green(`   [ok] Found ${queryCount.count} benchmark queries`));
  benchDb.close();

  // 4. Test embedding model
  console.log(pc.yellow("4. Testing embedding model..."));
  const modelId = "multilingual-e5-large";
  const model = createModelInstance({ modelId });
  const testEmbedding = await model.embed("test query", "query");
  const expectedDim = MODEL_REGISTRY[modelId]?.dimensions ?? 1024;
  if (testEmbedding.length !== expectedDim) {
    throw new Error(
      `Expected ${expectedDim} dimensions, got ${testEmbedding.length}`
    );
  }
  console.log(
    pc.green(`   [ok] Generated embedding with ${testEmbedding.length} dimensions`)
  );

  // 5. Test embedding count
  console.log(pc.yellow("5. Checking embeddings in Neon..."));
  const embeddingCount = await getEmbeddingCount(sql, modelId);
  console.log(pc.green(`   [ok] Found ${embeddingCount} embeddings for ${modelId}`));

  // 6. Test vector search (if embeddings exist)
  if (embeddingCount > 0) {
    console.log(pc.yellow("6. Testing vector search..."));
    const results = await searchSimilar(sql, testEmbedding, modelId, 3);
    console.log(pc.green(`   [ok] Search returned ${results.length} results`));
    for (const r of results) {
      console.log(
        pc.dim(`      - ${r.japanese} (${r.meaning}): ${r.similarity.toFixed(3)}`)
      );
    }
  } else {
    console.log(pc.yellow("6. Skipping vector search (no embeddings yet)"));
  }

  console.log(pc.cyan("\n--- All tests passed ---\n"));
}

runE2ETest().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red("\n[error] Test failed:"), message);
  console.error(
    pc.dim(`
  +-----------------------+
  |  DIAGNOSIS            |
  |  Something's awry.    |
  |  Check the logs above |
  |  and try again.       |
  +-----------------------+
`)
  );
  process.exit(1);
});
