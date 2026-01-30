import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

export const languages = sqliteTable('languages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const levels = sqliteTable(
  'levels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    languageId: integer('language_id').references(() => languages.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order'),
  },
  (table) => [unique().on(table.languageId, table.code)]
);

export const grammarPoints = sqliteTable('grammar_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(),
  japanese: text('japanese').notNull(),
  romaji: text('romaji'),
  meaning: text('meaning').notNull(),
  levelId: integer('level_id').references(() => levels.id),
  category: text('category'),
  formation: text('formation'),
  detailUrl: text('detail_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const examples = sqliteTable('examples', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grammarPointId: integer('grammar_point_id').references(() => grammarPoints.id, {
    onDelete: 'cascade',
  }),
  japanese: text('japanese').notNull(),
  english: text('english'),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
