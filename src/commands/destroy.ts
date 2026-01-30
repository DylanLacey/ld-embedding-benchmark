// src/commands/destroy.ts
// The great unmaking — delete project, obliterate config, scatter atoms to the void

import readline from "node:readline";
import ora from "ora";
import pc from "picocolors";
import { deleteNeonProject, getApiKey, getProjectId } from "../neon-api.js";
import { configExists, deleteConfigDir, readConfig } from "../paths.js";
import type { Config } from "../config/index.js";

async function confirm(message: string): Promise<boolean> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(`${message} (y/N) `, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === "y");
		});
	});
}

/**
 * Options for destroy command.
 */
export interface DestroyOptions {
	/** Skip confirmation prompt */
	force?: boolean;
	/** Unified config with possible CLI/env overrides */
	config?: Config;
}

export async function destroyProject(options: DestroyOptions = {}): Promise<void> {
	const spinner = ora();

	if (!configExists()) {
		console.log(pc.yellow("\n⚠ No project found. Nothing to destroy.\n"));
		return;
	}

	const config = readConfig();

	if (!options.force) {
		console.log(pc.red("\n╭────────────────────────────────────────╮"));
		console.log(pc.red("│  ⚠  WARNING: DESTRUCTIVE OPERATION    │"));
		console.log(pc.red("╰────────────────────────────────────────╯\n"));
		console.log(pc.yellow("This will:"));
		console.log(
			pc.dim(
				`  • Delete Neon project: ${config.neonProjectName} (${config.neonProjectId})`,
			),
		);
		console.log(pc.dim("  • Remove all branches and embeddings"));
		console.log(pc.dim("  • Delete ~/.embedding_test directory\n"));

		const confirmed = await confirm(pc.bold("Are you sure?"));
		if (!confirmed) {
			console.log(pc.dim("\nAborted.\n"));
			return;
		}
	}

	try {
		// Delete Neon project (use unified config for API key/project ID if provided)
		const apiKey = options.config?.neonApiKey ?? config.neonApiKey;
		const projectId = options.config?.neonProjectId ?? config.neonProjectId;

		if (projectId && apiKey) {
			spinner.start("Deleting Neon project...");
			await deleteNeonProject(apiKey, projectId);
			spinner.succeed("Neon project deleted");
		}

		// Delete config directory
		spinner.start("Removing config directory...");
		deleteConfigDir();
		spinner.succeed("Config directory removed");

		console.log(pc.green("\n✿ Project destroyed. Goodbye!\n"));
	} catch (error) {
		spinner.fail("Destroy failed");
		throw error;
	}
}
