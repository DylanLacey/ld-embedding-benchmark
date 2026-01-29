import { execa, type ExecaError } from "execa";
import type { ScrapeSummary } from "./types.js";

// Check if gum is installed
let gumAvailable: boolean | null = null;

export async function isGumInstalled(): Promise<boolean> {
  if (gumAvailable !== null) {
    return gumAvailable;
  }

  try {
    await execa("which", ["gum"]);
    gumAvailable = true;
    return true;
  } catch {
    gumAvailable = false;
    return false;
  }
}

// Prompt user to install gum if not available
export async function checkGumOrPrompt(): Promise<boolean> {
  if (await isGumInstalled()) {
    return true;
  }

  console.log("\n");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│  gum CLI not found                                          │");
  console.log("│                                                             │");
  console.log("│  gum provides beautiful terminal styling for this scraper. │");
  console.log("│  The scraper will work without it, but output will be      │");
  console.log("│  less visually appealing.                                   │");
  console.log("│                                                             │");
  console.log("│  To install gum:                                            │");
  console.log("│    macOS:   brew install gum                                │");
  console.log("│    Linux:   sudo apt install gum  (or your package manager) │");
  console.log("│    Other:   https://github.com/charmbracelet/gum           │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("\n");

  return false;
}

// Display styled header (with gum fallback)
export async function styledHeader(
  title: string,
  subtitle?: string
): Promise<void> {
  if (await isGumInstalled()) {
    const content = subtitle ? `${title}\n${subtitle}` : title;
    try {
      const result = await execa("gum", [
        "style",
        "--border",
        "rounded",
        "--border-foreground",
        "212",
        "--padding",
        "1 2",
        "--margin",
        "1",
        content,
      ]);
      console.log(result.stdout);
    } catch {
      // Fallback if gum fails
      printFallbackHeader(title, subtitle);
    }
  } else {
    printFallbackHeader(title, subtitle);
  }
}

function printFallbackHeader(title: string, subtitle?: string): void {
  const maxLen = Math.max(title.length, subtitle?.length ?? 0);
  const border = "─".repeat(maxLen + 4);
  console.log(`┌${border}┐`);
  console.log(`│  ${title.padEnd(maxLen)}  │`);
  if (subtitle) {
    console.log(`│  ${subtitle.padEnd(maxLen)}  │`);
  }
  console.log(`└${border}┘`);
}

// Display styled box
export async function styledBox(content: string): Promise<void> {
  if (await isGumInstalled()) {
    try {
      const result = await execa("gum", [
        "style",
        "--border",
        "rounded",
        "--padding",
        "0 1",
        content,
      ]);
      console.log(result.stdout);
    } catch {
      printFallbackBox(content);
    }
  } else {
    printFallbackBox(content);
  }
}

function printFallbackBox(content: string): void {
  const lines = content.split("\n");
  const maxLen = Math.max(...lines.map((l) => l.length));
  const border = "─".repeat(maxLen + 2);
  console.log(`┌${border}┐`);
  for (const line of lines) {
    console.log(`│ ${line.padEnd(maxLen)} │`);
  }
  console.log(`└${border}┘`);
}

// Spinner while executing async task
export async function spin<T>(
  title: string,
  fn: () => Promise<T>
): Promise<T> {
  if (await isGumInstalled()) {
    // Start spinner in background
    const spinner = execa("gum", ["spin", "--spinner", "dot", "--title", title, "--", "sleep", "3600"], {
      stdio: ["ignore", "pipe", "pipe"],
      reject: false,
    });

    try {
      const result = await fn();
      // Kill spinner when done
      spinner.kill();
      return result;
    } catch (error) {
      spinner.kill();
      throw error;
    }
  } else {
    // Fallback: just print the title and run
    process.stdout.write(`  ◌ ${title}...`);
    try {
      const result = await fn();
      process.stdout.write("\r");
      console.log(`  ✓ ${title}`);
      return result;
    } catch (error) {
      process.stdout.write("\r");
      console.log(`  ✗ ${title}`);
      throw error;
    }
  }
}

// Format and display final summary
export async function formatSummary(stats: ScrapeSummary): Promise<void> {
  const lines = [
    "Results",
    "",
    `  ✓ ${stats.grammarPointsScraped} grammar points scraped`,
    `  ✓ ${stats.exampleSentences} example sentences`,
    `  ✓ ${stats.relatedGrammarLinks} related grammar links`,
  ];

  if (stats.lexicalSimilarities > 0) {
    lines.push(`  ✓ ${stats.lexicalSimilarities} lexical similarity pairs`);
  }

  lines.push("", `  Output: ${stats.outputPath}`);

  const content = lines.join("\n");

  if (await isGumInstalled()) {
    try {
      const result = await execa("gum", [
        "style",
        "--border",
        "rounded",
        "--border-foreground",
        "10",
        "--padding",
        "0 1",
        "--margin",
        "1 0",
        content,
      ]);
      console.log(result.stdout);
    } catch {
      printFallbackBox(content);
    }
  } else {
    printFallbackBox(content);
  }
}

// Progress indicator for scraping (without listr2)
export function createProgressLine(current: number, total: number): string {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * 20);
  const empty = 20 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `  [${current}/${total}] ${bar} ${percent}%`;
}

// Print item status
export function printItemStatus(
  japanese: string,
  romaji: string,
  meaning: string,
  status: "pending" | "in_progress" | "done" | "error"
): void {
  const icons = {
    pending: "◻",
    in_progress: "◼",
    done: "✔",
    error: "✗",
  };
  const icon = icons[status];
  console.log(`  ${icon} ${japanese} (${romaji}) - ${meaning}`);
}
