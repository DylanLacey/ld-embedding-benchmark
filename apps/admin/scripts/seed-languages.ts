import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, '../../../data');
const db = new Database(resolve(DATA_DIR, 'grammar.db'));

// Create tables if not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS languages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id INTEGER REFERENCES languages(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER,
    UNIQUE(language_id, code)
  );
`);

// Seed Japanese + JLPT levels
const now = Date.now();

const insertLang = db.prepare(`
  INSERT OR IGNORE INTO languages (code, name, created_at, updated_at)
  VALUES (?, ?, ?, ?)
`);

const insertLevel = db.prepare(`
  INSERT OR IGNORE INTO levels (language_id, code, name, sort_order)
  VALUES (?, ?, ?, ?)
`);

insertLang.run('ja', 'Japanese', now, now);

const jaId = db.prepare(`SELECT id FROM languages WHERE code = ?`).get('ja') as { id: number };

const jlptLevels = [
  { code: 'N5', name: 'JLPT N5', order: 5 },
  { code: 'N4', name: 'JLPT N4', order: 4 },
  { code: 'N3', name: 'JLPT N3', order: 3 },
  { code: 'N2', name: 'JLPT N2', order: 2 },
  { code: 'N1', name: 'JLPT N1', order: 1 },
];

for (const level of jlptLevels) {
  insertLevel.run(jaId.id, level.code, level.name, level.order);
}

console.log('Seeded Japanese + JLPT levels');
