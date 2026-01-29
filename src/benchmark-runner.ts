// src/benchmark-runner.ts
// The proving grounds—where embedding models meet their reckoning
import { createNeonClient } from "./neon.js";
import { openBenchmarkDatabase } from "./benchmark-db.js";
import { createModelInstance } from "./embeddings/index.js";
import { searchSimilar } from "./neon-embeddings.js";
import { computeAllMetrics, type QueryEvaluation } from "./metrics.js";
import ora from "ora";

export interface RunBenchmarkOptions {
  modelId: string;
  branchUrl?: string;
  branchName: string;
}

export interface BenchmarkResult {
  runId: number;
  metrics: Map<string, number>;
  evaluations: QueryEvaluation[];
}

export async function runBenchmark(options: RunBenchmarkOptions): Promise<BenchmarkResult> {
  const { modelId, branchUrl, branchName } = options;
  const spinner = ora("Initialising benchmark...").start();

  const sql = createNeonClient(branchUrl);
  const benchDb = openBenchmarkDatabase();
  const model = createModelInstance({ modelId });

  try {
    // Get or create model record
    let modelRecord = benchDb
      .prepare("SELECT id FROM embedding_models WHERE model_id = ?")
      .get(modelId) as { id: number } | undefined;

    if (!modelRecord) {
      const result = benchDb
        .prepare("INSERT INTO embedding_models (provider, model_id, dimensions) VALUES (?, ?, ?)")
        .run(model.provider, modelId, model.dimensions);
      modelRecord = { id: Number(result.lastInsertRowid) };
    }

    // Load benchmark queries
    spinner.text = "Loading benchmark queries...";
    const queries = benchDb
      .prepare(`
        SELECT id, query_text, query_language, target_language, difficulty, is_ranked
        FROM benchmark_queries
      `)
      .all() as Array<{
        id: number;
        query_text: string;
        query_language: string;
        target_language: string;
        difficulty: string;
        is_ranked: number;
      }>;

    if (queries.length === 0) {
      spinner.warn("No benchmark queries found. Add queries first.");
      return { runId: 0, metrics: new Map(), evaluations: [] };
    }

    // Load expected results—the ground truth against which we measure
    const expectedMap = new Map<number, Array<{ grammarPointId: number; relevance: number | null }>>();
    const allExpected = benchDb
      .prepare("SELECT query_id, grammar_point_id, relevance_score FROM benchmark_expected")
      .all() as Array<{ query_id: number; grammar_point_id: number; relevance_score: number | null }>;

    for (const exp of allExpected) {
      const list = expectedMap.get(exp.query_id) ?? [];
      list.push({ grammarPointId: exp.grammar_point_id, relevance: exp.relevance_score });
      expectedMap.set(exp.query_id, list);
    }

    // Run evaluations—each query a small trial by vector
    const evaluations: QueryEvaluation[] = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      if (!query) continue;
      spinner.text = `Evaluating query ${i + 1}/${queries.length}...`;

      const expected = expectedMap.get(query.id) ?? [];

      // Embed query and measure latency
      const startTime = performance.now();
      const queryEmbedding = await model.embed(query.query_text, "query");
      const latencyMs = performance.now() - startTime;

      // Search for similar—the model's answer to the query
      const results = await searchSimilar(sql, queryEmbedding, modelId, 10);

      evaluations.push({
        queryId: query.id,
        expected,
        retrieved: results.map((r) => ({
          grammarPointId: r.grammarPointId,
          similarity: r.similarity,
        })),
        latencyMs,
      });
    }

    // Compute metrics—distilling performance into numbers
    spinner.text = "Computing metrics...";
    const metrics = computeAllMetrics(evaluations);

    // Store run
    const runResult = benchDb
      .prepare("INSERT INTO benchmark_runs (model_id, branch_name, latency_avg_ms) VALUES (?, ?, ?)")
      .run(modelRecord.id, branchName, metrics.get("avg_latency_ms") ?? null);

    const runId = Number(runResult.lastInsertRowid);

    // Store metrics—each number a verdict
    const insertMetric = benchDb.prepare(
      "INSERT INTO benchmark_metrics (run_id, metric_name, value) VALUES (?, ?, ?)"
    );

    for (const [name, value] of metrics) {
      insertMetric.run(runId, name, value);
    }

    spinner.succeed(`Benchmark complete. Run ID: ${runId}`);
    return { runId, metrics, evaluations };
  } catch (error) {
    spinner.fail("Benchmark failed");
    throw error;
  } finally {
    benchDb.close();
    // Neon serverless client auto-closes; no explicit teardown needed
  }
}
