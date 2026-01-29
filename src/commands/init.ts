// src/commands/init.ts
// Project initialisation — the big bang of your embedding benchmark universe
import ora from "ora";
import pc from "picocolors";
import { createNeonClient } from "../neon.js";
import { createNeonProject } from "../neon-api.js";
import { setupGrammarSchema } from "../neon-schema.js";
import { configExists, readConfig, writeConfig } from "../paths.js";

interface InitOptions {
	apiKey: string;
	projectName?: string;
	force?: boolean;
}

export async function initProject(options: InitOptions): Promise<void> {
	const { apiKey, projectName = "embedding-benchmark", force } = options;
	const spinner = ora();

	// Check existing config
	if (configExists() && !force) {
		const existing = readConfig();
		if (existing.neonProjectId) {
			console.log(pc.yellow("\n⚠ Project already initialised."));
			console.log(pc.dim(`  Project ID: ${existing.neonProjectId}`));
			console.log(
				pc.dim(
					`  Use --force to reinitialise (will NOT delete existing project)\n`,
				),
			);
			return;
		}
	}

	try {
		// Create Neon project
		spinner.start("Creating Neon project...");
		const { project, connectionUri } = await createNeonProject(
			apiKey,
			projectName,
		);
		spinner.succeed(`Created project: ${project.name} (${project.id})`);

		// Store config
		writeConfig({
			neonApiKey: apiKey,
			neonProjectId: project.id,
			neonProjectName: project.name,
			databaseUrl: connectionUri,
			createdAt: new Date().toISOString(),
		});

		// Setup schema
		spinner.start("Setting up database schema...");
		const sql = createNeonClient(connectionUri);
		await setupGrammarSchema(sql);
		spinner.succeed("Database schema ready");

		console.log(pc.green("\n✿ Initialisation complete!\n"));
		console.log(pc.dim("  Config stored in: ~/.embedding_test/config.json"));
		console.log(
			pc.dim(`  Database URL: ${connectionUri.replace(/:[^:@]+@/, ":***@")}\n`),
		);
		console.log(pc.cyan("Next steps:"));
		console.log(pc.dim("  1. embedding4ld migrate    # Import grammar data"));
		console.log(pc.dim("  2. embedding4ld embed <model>"));
		console.log(pc.dim("  3. embedding4ld benchmark <model>\n"));
	} catch (error) {
		spinner.fail("Initialisation failed");
		throw error;
	}
}
