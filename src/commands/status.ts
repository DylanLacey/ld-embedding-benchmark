// src/commands/status.ts
// The observatory — peek at the current state of things

import Table from "cli-table3";
import pc from "picocolors";
import { getApiKey, getProjectId, listNeonBranches } from "../neon-api.js";
import { CONFIG_DIR, configExists, readConfig } from "../paths.js";
import type { Config } from "../config/index.js";

/**
 * Options for status command.
 */
export interface StatusOptions {
  /** Unified config with possible CLI/env overrides */
  config?: Config;
}

export async function showStatus(options: StatusOptions = {}): Promise<void> {
  const { config: unifiedConfig } = options;

	if (!configExists()) {
		console.log(
			pc.yellow("\n⚠ Not initialised. Run 'embedding4ld init' first.\n"),
		);
		return;
	}

  // Read stored config for display (unified config might override for API calls)
	const config = readConfig();

	console.log(pc.cyan("\n╭────────────────────────────────────────╮"));
	console.log(
		pc.cyan("│  ") +
			pc.bold("embedding4ld status") +
			pc.cyan("                 │"),
	);
	console.log(pc.cyan("╰────────────────────────────────────────╯\n"));

	const configTable = new Table({
		style: { head: [], border: [] },
	});

	configTable.push(
		[pc.dim("Config dir"), CONFIG_DIR],
		[pc.dim("Project"), `${config.neonProjectName} (${config.neonProjectId})`],
		[pc.dim("Created"), config.createdAt ?? "unknown"],
		[
			pc.dim("Database"),
			config.databaseUrl?.replace(/:[^:@]+@/, ":***@") ?? "not set",
		],
	);

	console.log(configTable.toString());

	// List branches (use unified config for API key/project ID if provided)
	try {
		const branches = await listNeonBranches(getApiKey(unifiedConfig), getProjectId(unifiedConfig));

		console.log(pc.cyan("\nBranches:"));
		const branchTable = new Table({
			head: [pc.bold("name"), pc.bold("id"), pc.bold("parent")],
			style: { head: [], border: [] },
		});

		for (const branch of branches) {
			branchTable.push([
				branch.name,
				branch.id,
				branch.parent_id ?? pc.dim("(root)"),
			]);
		}

		console.log(branchTable.toString());
	} catch {
		console.log(pc.yellow("\n⚠ Could not fetch branches"));
	}

	console.log();
}
