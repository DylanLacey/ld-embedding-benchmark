// src/benchmark-db.ts
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const BENCHMARK_DB_PATH = path.join(DATA_DIR, "benchmark.db");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initializeBenchmarkSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS benchmark_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_text TEXT NOT NULL,
      query_language TEXT NOT NULL,
      target_language TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('direct', 'descriptive', 'situational', 'adversarial')),
      is_ranked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS benchmark_expected (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_id INTEGER NOT NULL REFERENCES benchmark_queries(id) ON DELETE CASCADE,
      grammar_point_id INTEGER NOT NULL,
      relevance_score INTEGER CHECK (relevance_score IS NULL OR relevance_score BETWEEN 1 AND 3),
      UNIQUE(query_id, grammar_point_id)
    );

    CREATE TABLE IF NOT EXISTS embedding_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(provider, model_id)
    );

    CREATE TABLE IF NOT EXISTS benchmark_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL REFERENCES embedding_models(id),
      branch_name TEXT NOT NULL,
      run_at TEXT DEFAULT CURRENT_TIMESTAMP,
      latency_avg_ms REAL
    );

    CREATE TABLE IF NOT EXISTS benchmark_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
      metric_name TEXT NOT NULL,
      value REAL NOT NULL,
      UNIQUE(run_id, metric_name)
    );

    CREATE INDEX IF NOT EXISTS idx_expected_query ON benchmark_expected(query_id);
    CREATE INDEX IF NOT EXISTS idx_runs_model ON benchmark_runs(model_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_run ON benchmark_metrics(run_id);

    CREATE TRIGGER IF NOT EXISTS update_query_timestamp
      AFTER UPDATE ON benchmark_queries
      BEGIN
        UPDATE benchmark_queries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
  `);
}

export function openBenchmarkDatabase(): Database.Database {
  ensureDataDir();
  const db = new Database(BENCHMARK_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initializeBenchmarkSchema(db);
  return db;
}

// Types
export interface BenchmarkQuery {
  id: number;
  queryText: string;
  queryLanguage: string;
  targetLanguage: string;
  difficulty: "direct" | "descriptive" | "situational" | "adversarial";
  isRanked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkExpected {
  id: number;
  queryId: number;
  grammarPointId: number;
  relevanceScore: number | null;
}

export interface EmbeddingModelRecord {
  id: number;
  provider: string;
  modelId: string;
  dimensions: number;
  isActive: boolean;
}

export interface BenchmarkRun {
  id: number;
  modelId: number;
  branchName: string;
  runAt: string;
  latencyAvgMs: number | null;
}

export interface BenchmarkMetric {
  id: number;
  runId: number;
  metricName: string;
  value: number;
}
