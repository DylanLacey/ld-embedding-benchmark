import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

export const benchmarkQueries = sqliteTable('benchmark_queries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  queryText: text('query_text').notNull(),
  queryLanguage: text('query_language'),
  targetLanguage: text('target_language'),
  difficulty: text('difficulty'),
  isRanked: integer('is_ranked', { mode: 'boolean' }),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const benchmarkExpected = sqliteTable(
  'benchmark_expected',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    queryId: integer('query_id').references(() => benchmarkQueries.id, {
      onDelete: 'cascade',
    }),
    grammarPointId: integer('grammar_point_id').notNull(),
    relevanceScore: integer('relevance_score'),
  },
  (table) => [unique().on(table.queryId, table.grammarPointId)]
);
