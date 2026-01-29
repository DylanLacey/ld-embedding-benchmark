// src/migrate-to-neon.ts
import { createNeonClient } from "./neon.js";
import { setupGrammarSchema } from "./neon-schema.js";
import { openDatabase, getAllGrammarPoints } from "./db.js";
import ora from "ora";

/**
 * Migrates grammar data from local SQLite to Neon Postgres.
 * Uses upsert semantics — run it twice and nothing explodes.
 * (Well, probably. No promises about the third time.)
 */
export async function migrateGrammarToNeon(): Promise<void> {
	const spinner = ora("Connecting to Neon...").start();

	const sql = createNeonClient();
	const localDb = openDatabase();

	try {
		// Setup schema
		spinner.text = "Setting up Neon schema...";
		await setupGrammarSchema(sql);

		// Get local grammar data
		spinner.text = "Reading local grammar data...";
		const grammarPoints = getAllGrammarPoints(localDb);

		spinner.text = `Migrating ${grammarPoints.length} grammar points...`;

		for (const gp of grammarPoints) {
			// Insert grammar point with upsert — the diplomatic way to handle conflicts
			const result = await sql`
				INSERT INTO grammar_points (slug, japanese, romaji, meaning, level, category, detail_url, formation)
				VALUES (${gp.slug}, ${gp.japanese}, ${gp.romaji}, ${gp.meaning}, ${gp.level}, ${gp.category}, ${gp.detailUrl}, ${gp.formation ?? null})
				ON CONFLICT (slug) DO UPDATE SET
					japanese = EXCLUDED.japanese,
					romaji = EXCLUDED.romaji,
					meaning = EXCLUDED.meaning,
					level = EXCLUDED.level,
					category = EXCLUDED.category,
					detail_url = EXCLUDED.detail_url,
					formation = EXCLUDED.formation,
					updated_at = NOW()
				RETURNING id
			`;

			// The Neon serverless client returns a union type; we expect an array of records
			// from RETURNING. Runtime validation guards against schema mismatches.
			const rows = result as unknown as Array<Record<string, unknown>>;
			const firstRow = rows[0];
			const grammarId =
				firstRow && typeof firstRow.id === "number" ? firstRow.id : undefined;
			if (grammarId === undefined) {
				throw new Error(`Failed to upsert grammar point: ${gp.slug}`);
			}

			// Delete existing examples and insert fresh ones
			// (could track individual examples but life is short)
			await sql`DELETE FROM examples WHERE grammar_point_id = ${grammarId}`;

			for (const ex of gp.examples) {
				await sql`
					INSERT INTO examples (grammar_point_id, japanese, english, source)
					VALUES (${grammarId}, ${ex.japanese}, ${ex.english}, ${ex.source})
				`;
			}
		}

		spinner.succeed(`Migrated ${grammarPoints.length} grammar points to Neon`);
	} catch (error) {
		spinner.fail("Migration failed");
		throw error;
	} finally {
		localDb.close();
	}
}

// Run if executed directly — the "main" pattern for ESM
if (import.meta.url === `file://${process.argv[1]}`) {
	migrateGrammarToNeon().catch(console.error);
}
