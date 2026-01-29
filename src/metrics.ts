// src/metrics.ts
// Evaluation metrics for retrieval quality benchmarking.
// Where precision meets poetry: how well did we divine the grammar?

export interface QueryEvaluation {
  queryId: number;
  expected: Array<{ grammarPointId: number; relevance: number | null }>;
  retrieved: Array<{ grammarPointId: number; similarity: number }>;
  latencyMs: number;
}

/**
 * Recall@K: fraction of relevant items found in top K results.
 * The classic "did we find what we were looking for?" metric.
 */
export function computeRecallAtK(evals: QueryEvaluation[], k: number): number {
  if (evals.length === 0) return 0;

  let totalRecall = 0;
  for (const e of evals) {
    const relevantIds = new Set(e.expected.map((x) => x.grammarPointId));
    if (relevantIds.size === 0) continue;

    const topK = e.retrieved.slice(0, k).map((x) => x.grammarPointId);
    const found = topK.filter((id) => relevantIds.has(id)).length;
    totalRecall += found / relevantIds.size;
  }

  return totalRecall / evals.length;
}

/**
 * MRR: Mean Reciprocal Rank.
 * How quickly do we surface the first correct answer?
 * RR = 1 for first position, 0.5 for second, 0.33 for third...
 */
export function computeMRR(evals: QueryEvaluation[]): number {
  if (evals.length === 0) return 0;

  let totalRR = 0;
  for (const e of evals) {
    const relevantIds = new Set(e.expected.map((x) => x.grammarPointId));
    const rank = e.retrieved.findIndex((x) => relevantIds.has(x.grammarPointId));
    if (rank >= 0) {
      totalRR += 1 / (rank + 1);
    }
  }

  return totalRR / evals.length;
}

/**
 * Hit@K: did any correct answer land in the top K?
 * Binary success metric - either we hit or we miss.
 */
export function computeHitAtK(evals: QueryEvaluation[], k: number): number {
  if (evals.length === 0) return 0;

  let hits = 0;
  for (const e of evals) {
    const relevantIds = new Set(e.expected.map((x) => x.grammarPointId));
    const topK = e.retrieved.slice(0, k).map((x) => x.grammarPointId);
    if (topK.some((id) => relevantIds.has(id))) {
      hits++;
    }
  }

  return hits / evals.length;
}

/**
 * NDCG: Normalised Discounted Cumulative Gain.
 * For queries with graded relevance (1-3 scores), measures ranking quality.
 * Rewards putting highly relevant items near the top.
 */
export function computeNDCG(evals: QueryEvaluation[], k = 10): number {
  // Only evaluate queries that have graded relevance scores
  const rankedEvals = evals.filter((e) =>
    e.expected.some((x) => x.relevance !== null)
  );
  if (rankedEvals.length === 0) return 0;

  let totalNDCG = 0;

  for (const e of rankedEvals) {
    const relevanceMap = new Map(
      e.expected
        .filter((x) => x.relevance !== null)
        .map((x) => [x.grammarPointId, x.relevance as number])
    );

    // DCG: Discounted Cumulative Gain for actual ranking
    let dcg = 0;
    const retrievedSlice = e.retrieved.slice(0, k);
    for (let i = 0; i < retrievedSlice.length; i++) {
      const item = retrievedSlice[i];
      if (item) {
        const rel = relevanceMap.get(item.grammarPointId) ?? 0;
        dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
      }
    }

    // IDCG: Ideal DCG (best possible ranking)
    const idealRanking = [...relevanceMap.values()]
      .sort((a, b) => b - a)
      .slice(0, k);
    let idcg = 0;
    for (let i = 0; i < idealRanking.length; i++) {
      const rel = idealRanking[i];
      if (rel !== undefined) {
        idcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
      }
    }

    if (idcg > 0) {
      totalNDCG += dcg / idcg;
    }
  }

  return totalNDCG / rankedEvals.length;
}

/**
 * Average latency across all query evaluations.
 * Because speed matters, even when chasing precision.
 */
export function computeAvgLatency(evals: QueryEvaluation[]): number {
  if (evals.length === 0) return 0;
  return evals.reduce((sum, e) => sum + e.latencyMs, 0) / evals.length;
}

/**
 * Compute all standard metrics in one pass.
 * Returns a Map for easy iteration and storage.
 */
export function computeAllMetrics(evals: QueryEvaluation[]): Map<string, number> {
  return new Map([
    ["recall@1", computeRecallAtK(evals, 1)],
    ["recall@3", computeRecallAtK(evals, 3)],
    ["recall@5", computeRecallAtK(evals, 5)],
    ["mrr", computeMRR(evals)],
    ["ndcg", computeNDCG(evals)],
    ["hit@1", computeHitAtK(evals, 1)],
    ["avg_latency_ms", computeAvgLatency(evals)],
  ]);
}
