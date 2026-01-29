import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type {
  GrammarPoint,
  Example,
  JLPTLevel,
  GrammarCategory,
} from "./types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "grammar.db");

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Initialize database with schema
function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS grammar_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      japanese TEXT NOT NULL,
      romaji TEXT NOT NULL,
      meaning TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      formation TEXT,
      detail_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grammar_id INTEGER NOT NULL,
      japanese TEXT NOT NULL,
      english TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grammar_id) REFERENCES grammar_points(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS related_grammar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grammar_id INTEGER NOT NULL,
      related_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grammar_id) REFERENCES grammar_points(id) ON DELETE CASCADE
    );

    -- Create triggers if they don't exist
    CREATE TRIGGER IF NOT EXISTS update_grammar_timestamp
      AFTER UPDATE ON grammar_points
      BEGIN
        UPDATE grammar_points SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS update_example_timestamp
      AFTER UPDATE ON examples
      BEGIN
        UPDATE examples SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    -- Table for lexicographically similar grammar forms
    -- (forms that look alike but have different meanings)
    CREATE TABLE IF NOT EXISTS lexical_similarities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grammar_id_a INTEGER NOT NULL,
      grammar_id_b INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grammar_id_a) REFERENCES grammar_points(id) ON DELETE CASCADE,
      FOREIGN KEY (grammar_id_b) REFERENCES grammar_points(id) ON DELETE CASCADE,
      UNIQUE(grammar_id_a, grammar_id_b)
    );

    -- Create indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_examples_grammar_id ON examples(grammar_id);
    CREATE INDEX IF NOT EXISTS idx_related_grammar_id ON related_grammar(grammar_id);
    CREATE INDEX IF NOT EXISTS idx_related_grammar_url ON related_grammar(related_url);
    CREATE INDEX IF NOT EXISTS idx_grammar_level ON grammar_points(level);
    CREATE INDEX IF NOT EXISTS idx_grammar_category ON grammar_points(category);
    CREATE INDEX IF NOT EXISTS idx_grammar_detail_url ON grammar_points(detail_url);
    CREATE INDEX IF NOT EXISTS idx_lexical_a ON lexical_similarities(grammar_id_a);
    CREATE INDEX IF NOT EXISTS idx_lexical_b ON lexical_similarities(grammar_id_b);
  `);
}

// Create or open database
export function openDatabase(): Database.Database {
  ensureDataDir();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initializeSchema(db);
  return db;
}

// Insert or update a grammar point
export function upsertGrammarPoint(
  db: Database.Database,
  data: {
    slug: string;
    japanese: string;
    romaji: string;
    meaning: string;
    level: JLPTLevel;
    category: GrammarCategory;
    detailUrl: string;
    formation?: string;
  }
): number {
  const existing = db
    .prepare("SELECT id FROM grammar_points WHERE slug = ?")
    .get(data.slug) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE grammar_points
      SET japanese = ?, romaji = ?, meaning = ?, level = ?, category = ?, formation = ?, detail_url = ?
      WHERE id = ?
    `).run(
      data.japanese,
      data.romaji,
      data.meaning,
      data.level,
      data.category,
      data.formation ?? null,
      data.detailUrl,
      existing.id
    );
    return existing.id;
  } else {
    const result = db
      .prepare(`
      INSERT INTO grammar_points (slug, japanese, romaji, meaning, level, category, formation, detail_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        data.slug,
        data.japanese,
        data.romaji,
        data.meaning,
        data.level,
        data.category,
        data.formation ?? null,
        data.detailUrl
      );
    return Number(result.lastInsertRowid);
  }
}

// Delete existing examples for a grammar point and insert new ones
export function replaceExamples(
  db: Database.Database,
  grammarId: number,
  examples: { japanese: string; english: string }[],
  source: string
): void {
  db.prepare("DELETE FROM examples WHERE grammar_id = ?").run(grammarId);

  const insert = db.prepare(`
    INSERT INTO examples (grammar_id, japanese, english, source)
    VALUES (?, ?, ?, ?)
  `);

  for (const example of examples) {
    insert.run(grammarId, example.japanese, example.english, source);
  }
}

// Delete existing related grammar and insert new ones
export function replaceRelatedGrammar(
  db: Database.Database,
  grammarId: number,
  urls: string[]
): void {
  db.prepare("DELETE FROM related_grammar WHERE grammar_id = ?").run(grammarId);

  const insert = db.prepare(`
    INSERT INTO related_grammar (grammar_id, related_url)
    VALUES (?, ?)
  `);

  for (const url of urls) {
    insert.run(grammarId, url);
  }
}

// Get all grammar points with examples and related grammar
export function getAllGrammarPoints(db: Database.Database): GrammarPoint[] {
  const points = db
    .prepare(`
    SELECT
      id, slug, japanese, romaji, meaning, level, category,
      formation, detail_url as detailUrl,
      created_at as createdAt, updated_at as updatedAt
    FROM grammar_points
    ORDER BY id
  `)
    .all() as Array<{
    id: number;
    slug: string;
    japanese: string;
    romaji: string;
    meaning: string;
    level: JLPTLevel;
    category: GrammarCategory;
    formation: string | null;
    detailUrl: string;
    createdAt: string;
    updatedAt: string;
  }>;

  const getExamples = db.prepare(`
    SELECT id, japanese, english, source
    FROM examples
    WHERE grammar_id = ?
    ORDER BY id
  `);

  const getRelatedUrls = db.prepare(`
    SELECT related_url
    FROM related_grammar
    WHERE grammar_id = ?
    ORDER BY id
  `);

  return points.map((point) => {
    const examples = getExamples.all(point.id) as Example[];
    const relatedRows = getRelatedUrls.all(point.id) as Array<{
      related_url: string;
    }>;

    const result: GrammarPoint = {
      id: point.id,
      slug: point.slug,
      japanese: point.japanese,
      romaji: point.romaji,
      meaning: point.meaning,
      level: point.level,
      category: point.category,
      detailUrl: point.detailUrl,
      createdAt: point.createdAt,
      updatedAt: point.updatedAt,
      examples,
      relatedGrammarUrls: relatedRows.map((r) => r.related_url),
    };

    // Only add formation if it exists
    if (point.formation !== null) {
      result.formation = point.formation;
    }

    return result;
  });
}

// Check if a grammar point exists by slug
export function grammarPointExists(db: Database.Database, slug: string): boolean {
  const result = db
    .prepare("SELECT 1 FROM grammar_points WHERE slug = ?")
    .get(slug);
  return result !== undefined;
}

// Find grammar points that list a URL in their related_grammar
export function findGrammarPointsWithRelatedUrl(
  db: Database.Database,
  url: string
): number[] {
  const rows = db
    .prepare(`
      SELECT DISTINCT grammar_id
      FROM related_grammar
      WHERE related_url = ?
    `)
    .all(url) as Array<{ grammar_id: number }>;
  return rows.map((r) => r.grammar_id);
}

// Add a lexical similarity relationship (bidirectional)
export function addLexicalSimilarity(
  db: Database.Database,
  grammarIdA: number,
  grammarIdB: number
): void {
  // Ensure consistent ordering (smaller id first) to avoid duplicates
  const [idA, idB] = grammarIdA < grammarIdB
    ? [grammarIdA, grammarIdB]
    : [grammarIdB, grammarIdA];

  db.prepare(`
    INSERT OR IGNORE INTO lexical_similarities (grammar_id_a, grammar_id_b)
    VALUES (?, ?)
  `).run(idA, idB);
}

// Get all lexical similarities
export function getLexicalSimilarities(
  db: Database.Database
): Array<{ grammarIdA: number; grammarIdB: number }> {
  return db
    .prepare(`
      SELECT grammar_id_a as grammarIdA, grammar_id_b as grammarIdB
      FROM lexical_similarities
      ORDER BY grammar_id_a, grammar_id_b
    `)
    .all() as Array<{ grammarIdA: number; grammarIdB: number }>;
}

// Get statistics for summary
export function getStats(
  db: Database.Database
): { grammarCount: number; exampleCount: number; relatedCount: number; lexicalCount: number } {
  const grammar = db
    .prepare("SELECT COUNT(*) as count FROM grammar_points")
    .get() as { count: number };
  const examples = db
    .prepare("SELECT COUNT(*) as count FROM examples")
    .get() as { count: number };
  const related = db
    .prepare("SELECT COUNT(*) as count FROM related_grammar")
    .get() as { count: number };
  const lexical = db
    .prepare("SELECT COUNT(*) as count FROM lexical_similarities")
    .get() as { count: number };

  return {
    grammarCount: grammar.count,
    exampleCount: examples.count,
    relatedCount: related.count,
    lexicalCount: lexical.count,
  };
}

// Export database to JSON file
export function exportToJson(db: Database.Database): string {
  const grammarPoints = getAllGrammarPoints(db);
  const lexicalSimilarities = getLexicalSimilarities(db);

  const data = {
    grammarPoints,
    lexicalSimilarities,
  };

  const outputPath = path.join(DATA_DIR, "grammar.json");
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  return outputPath;
}
