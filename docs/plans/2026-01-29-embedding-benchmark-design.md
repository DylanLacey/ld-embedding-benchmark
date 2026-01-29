# Embedding Benchmark for Multi-linguistic Grammar Retrieval

Design document for a system to evaluate embedding models' ability to map natural language queries to grammatical constructs across languages.

## Problem Statement

Users ask questions like "How do I say 'I have a ball' in Japanese?" and need to find relevant grammatical constructs (e.g., possession, existence) from a curated grammar database. The system uses HyPE-style query transformation followed by vector search.

This benchmark determines which embedding models best bridge the semantic gap between:
- Multilingual, mixed-language user queries (English, code-switched, any language)
- Language-specific grammatical construct inventories

## Scope

### In Scope (v1)
- ~50-100 hand-crafted test queries
- Japanese grammar inventory (existing data)
- 4-5 embedding models across providers
- All query difficulty levels (direct, descriptive, situational, adversarial)
- CLI-first tooling with admin UI for test authoring

### Parked for Later
- Additional target languages (infrastructure supports it)
- Hybrid search / reranker architectures
- LLM-as-judge evaluation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐    │
│   │ SvelteKit   │    │ CLI         │    │ Embedding Providers     │    │
│   │ Admin UI    │    │ (gum/lip)   │    │ ┌─────┐ ┌─────┐ ┌─────┐ │    │
│   └──────┬──────┘    └──────┬──────┘    │ │ HF  │ │ OAI │ │Cohere│ │    │
│          │                  │           │ └─────┘ └─────┘ └─────┘ │    │
│          │                  │           └───────────┬─────────────┘    │
│          ▼                  ▼                       │                  │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    Benchmark Runner                            │   │
│   │  - orchestrates embedding + search + evaluation                │   │
│   │  - computes metrics (Recall@K, MRR, NDCG, Hit@1)              │   │
│   └───────────────────────┬────────────────────┬───────────────────┘   │
│                           │                    │                       │
│          ┌────────────────┘                    └────────────────┐      │
│          ▼                                                      ▼      │
│   ┌─────────────────┐                              ┌─────────────────┐ │
│   │ SQLite          │                              │ Neon (pgvector) │ │
│   │                 │                              │                 │ │
│   │ • grammar_pts   │   grammar sync               │ • grammar_      │ │
│   │ • examples      │ ─────────────────────────▶   │   embeddings    │ │
│   │ • benchmark_*   │                              │                 │ │
│   │ • runs/metrics  │                              │                 │ │
│   └─────────────────┘                              └─────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Storage Split Rationale

**SQLite (local):** Fast iteration on test cases, no network latency for CRUD, version-controllable schema. Stores grammar points, examples, benchmark queries, runs, and metrics.

**Neon/pgvector (remote):** Vector similarity search that mirrors production infrastructure. Stores grammar embeddings only.

## Data Model

### Existing Tables (SQLite)

```sql
grammar_points    -- id, slug, japanese, meaning, level, category, ...
examples          -- id, grammar_point_id, japanese, english, source
```

### New Benchmark Tables (SQLite)

```sql
CREATE TABLE benchmark_queries (
  id INTEGER PRIMARY KEY,
  query_text TEXT NOT NULL,
  query_language TEXT NOT NULL,      -- 'en', 'ja', 'mixed', etc.
  target_language TEXT NOT NULL,     -- 'ja', 'es', etc.
  difficulty TEXT NOT NULL,          -- 'direct', 'descriptive', 'situational', 'adversarial'
  is_ranked BOOLEAN NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE benchmark_expected (
  id INTEGER PRIMARY KEY,
  query_id INTEGER NOT NULL REFERENCES benchmark_queries(id),
  grammar_point_id INTEGER NOT NULL REFERENCES grammar_points(id),
  relevance_score INTEGER,           -- 1-3 for ranked queries, NULL for unranked
  UNIQUE(query_id, grammar_point_id)
);

CREATE TABLE embedding_models (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,            -- 'huggingface', 'openai', 'cohere', 'bedrock'
  model_id TEXT NOT NULL,            -- 'multilingual-e5-large', etc.
  dimensions INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(provider, model_id)
);

CREATE TABLE benchmark_runs (
  id INTEGER PRIMARY KEY,
  model_id INTEGER NOT NULL REFERENCES embedding_models(id),
  run_at TEXT DEFAULT CURRENT_TIMESTAMP,
  latency_avg_ms REAL
);

CREATE TABLE benchmark_metrics (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES benchmark_runs(id),
  metric_name TEXT NOT NULL,         -- 'recall@1', 'mrr', 'ndcg', etc.
  value REAL NOT NULL,
  UNIQUE(run_id, metric_name)
);
```

### Vector Storage (Neon/pgvector)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE grammar_embeddings (
  id SERIAL PRIMARY KEY,
  grammar_point_id INTEGER NOT NULL,
  model_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,         -- 'name_meaning', 'example', 'formation'
  source_text TEXT NOT NULL,
  embedding vector(1024),            -- dimension varies by model

  UNIQUE(grammar_point_id, model_id, source_type, source_text)
);

CREATE INDEX ON grammar_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

## Embedding Provider Abstraction

### Interface

```typescript
interface EmbeddingModel {
  readonly provider: string
  readonly modelId: string
  readonly dimensions: number

  embed(text: string, type?: "query" | "document"): Promise<number[]>
  embedBatch(texts: string[], type?: "query" | "document"): Promise<number[][]>
}
```

### Factory

```typescript
const MODEL_REGISTRY = {
  "multilingual-e5-large":    { provider: "huggingface", dimensions: 1024 },
  "LaBSE":                    { provider: "huggingface", dimensions: 768 },
  "BGE-M3":                   { provider: "huggingface", dimensions: 1024 },
  "text-embedding-3-small":   { provider: "openai", dimensions: 1536 },
  "text-embedding-3-large":   { provider: "openai", dimensions: 3072 },
  "embed-multilingual-v3.0":  { provider: "cohere", dimensions: 1024 },
}

function createModelInstance(config: {
  modelId: string
  provider?: string    // inferred from registry if unambiguous
  apiKey?: string      // falls back to env vars
}): EmbeddingModel
```

### Provider Notes

| Provider | SDK | Batch Limit | Notes |
|----------|-----|-------------|-------|
| HuggingFace | `@huggingface/inference` | varies | Already installed |
| OpenAI | `openai` | 2048 | Variable dimensions option |
| Cohere | `cohere-ai` | 96 | Has `input_type` param (query vs document) |
| Bedrock | `@aws-sdk/client-bedrock-runtime` | varies | Titan + Cohere models |

## Multiple Vectors per Construct

Each grammar point generates several embeddings:

| Source Type | Example Content |
|-------------|-----------------|
| `name_meaning` | "と - if/when (natural result)" |
| `formation` | "Verb (dictionary / ない form) + と" |
| `example` | "ラーメンを毎日食べると太りますよ。" |

Query matches against **any** vector for a construct; best match wins:

```sql
SELECT DISTINCT ON (grammar_point_id)
  grammar_point_id,
  MAX(1 - (embedding <=> $1)) AS best_similarity
FROM grammar_embeddings
WHERE model_id = $2
GROUP BY grammar_point_id
ORDER BY best_similarity DESC
LIMIT $3;
```

## Evaluation Metrics

### Query Types

| Type | Relevance Scores | Primary Metrics |
|------|------------------|-----------------|
| Unranked | All NULL (equally valid) | Recall@K |
| Ranked | 1-3 (graded relevance) | NDCG, Hit@1 |

### Metrics Computed

| Metric | Description |
|--------|-------------|
| `recall@1` | Did any correct answer appear in top 1? |
| `recall@3` | Fraction of relevant items in top 3 |
| `recall@5` | Fraction of relevant items in top 5 |
| `mrr` | Mean Reciprocal Rank — how quickly is first correct answer found? |
| `ndcg` | Normalised Discounted Cumulative Gain — penalises lower-ranked "best" answers |
| `hit@1` | Did the **best** answer (relevance=3) land in top slot? |
| `avg_latency_ms` | Mean embedding latency per query |

### Query Difficulty Levels

All four levels included in benchmark:

- **Direct** — Uses grammatical terminology ("What is the conditional form?")
- **Descriptive** — Describes meaning without jargon ("How do I say 'if I go, you go'?")
- **Situational** — Contextual, no explicit grammar mention ("I want to tell my friend what happens when it rains")
- **Adversarial** — Near-misses, ambiguous cases, could match multiple constructs

## Benchmark Runner Workflow

```
1. Select model to benchmark
2. Ensure grammar embeddings exist in Neon for that model
   └─ If not, embed all grammar constructs and store
3. Load benchmark queries from SQLite
4. For each query:
   a. Embed query text via model API (measure latency)
   b. Search Neon for top-K similar grammar embeddings
   c. Map results back to grammar_point_ids
   d. Compare against expected results from benchmark_expected
5. Compute aggregate metrics
6. Store run + metrics in SQLite
```

## CLI Interface

### Commands

```
embedding4ld embed <model>
  - Embeds all grammar constructs for the given model
  - Stores vectors in Neon
  - Skips if embeddings already exist (--force to re-embed)

embedding4ld benchmark <model>
  - Runs all benchmark queries against the model
  - Computes and stores metrics
  - Outputs summary to terminal

embedding4ld compare [model1] [model2] ...
  - Compares metrics across models (or all if none specified)
  - Tabular output: model × metric

embedding4ld list-models
  - Shows registered models and which have embeddings

embedding4ld list-runs [--model <model>]
  - Shows historical benchmark runs
```

### Visual Style

Charmbracelet retrofuturist aesthetic using `gum` and `lipgloss`:

- ASCII art banner
- Nixie-style counters for progress
- Box-drawing tables with sparkline bars for metrics
- Playful error messages with ASCII figures
- Verdicts and commentary after comparisons

## Admin UI (SvelteKit)

### Routes

```
/                       → Dashboard: run counts, model comparison summary
/queries                → List/filter benchmark queries
/queries/new            → Create new test query
/queries/[id]           → Edit query + manage expected grammar mappings
/grammar                → Browse grammar inventory (read-only)
/grammar/[id]           → View grammar point + examples
/runs                   → Historical benchmark runs
/runs/[id]              → Drill into run: per-query results, misses
```

### Tech Stack

- SvelteKit + Svelte 5
- Tailwind CSS v4
- `better-sqlite3` (server-side only)
- No auth — local development tool

### Key Views

**Query Editor:** Form for query text, language, difficulty, ranked flag. Table of expected grammar points with relevance stars (1-3).

**Run Drill-down:** Filter by hits/misses. Per-query comparison of expected vs retrieved, showing where models struggle.

## Environment Variables

```
HF_TOKEN=               # HuggingFace API token
OPENAI_API_KEY=         # OpenAI API key
COHERE_API_KEY=         # Cohere API key
DATABASE_URL=           # Neon postgres connection string
```

## Future Extensions (Parked)

- **Additional target languages** — Hand-craft grammar inventories for Spanish, Mandarin, etc.
- **Hybrid search** — Combine BM25 keyword search with vector similarity
- **Rerankers** — Two-stage retrieval: embed → retrieve → cross-encoder rerank
- **LLM-as-judge** — Use LLM to evaluate retrieval quality beyond mechanical metrics
- **Multi-stage pipelines** — Pluggable retrieval strategies in benchmark runner
