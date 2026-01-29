import * as cheerio from "cheerio";
import { chromium, type Browser, type Page } from "playwright";
import { Listr, type ListrTask } from "listr2";
import {
  openDatabase,
  upsertGrammarPoint,
  replaceExamples,
  replaceRelatedGrammar,
  getStats,
  exportToJson,
  grammarPointExists,
  findGrammarPointsWithRelatedUrl,
  addLexicalSimilarity,
} from "./db.js";
import {
  styledHeader,
  formatSummary,
  checkGumOrPrompt,
} from "./ui.js";
import type {
  TargetGrammarForm,
  ParsedDetailPage,
} from "./types.js";

// ============================================================================
// Target Grammar Forms - Hardcoded URLs
// ============================================================================

const TARGET_GRAMMAR: TargetGrammarForm[] = [
  // Conditionals
  {
    slug: "to",
    japanese: "と",
    romaji: "to",
    meaning: "if/when (natural result)",
    level: "N4",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a8-to-meaning/",
  },
  {
    slug: "ba",
    japanese: "ば",
    romaji: "ba",
    meaning: "if (hypothetical)",
    level: "N4",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0-ba-conditional-form-meaning/",
  },
  {
    slug: "tara",
    japanese: "たら",
    romaji: "tara",
    meaning: "if/when (completed)",
    level: "N4",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%9f%e3%82%89-tara-meaning/",
  },
  {
    slug: "nara",
    japanese: "なら",
    romaji: "nara",
    meaning: "if (contextual)",
    level: "N4",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%aa%e3%82%89-nara-meaning/",
  },
  {
    slug: "temo",
    japanese: "ても",
    romaji: "temo",
    meaning: "even if; even though",
    level: "N4",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a6%e3%82%82-temo-meaning/",
  },
  {
    slug: "noni",
    japanese: "のに",
    romaji: "noni",
    meaning: "although; despite",
    level: "N3",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%ae%e3%81%ab-noni-meaning/",
  },
  {
    slug: "ba-hodo",
    japanese: "ば〜ほど",
    romaji: "ba~hodo",
    meaning: "the more... the more",
    level: "N3",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%ef%bd%9e%e3%81%bb%e3%81%a9-ba-hodo-meaning/",
  },
  {
    slug: "toshitemo",
    japanese: "としても",
    romaji: "toshitemo",
    meaning: "even assuming; even if",
    level: "N2",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a8%e3%81%97%e3%81%a6%e3%82%82-toshitemo-meaning/",
  },
  {
    slug: "tatoe-temo",
    japanese: "たとえ〜ても",
    romaji: "tatoe~temo",
    meaning: "even if (hypothetical)",
    level: "N2",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%9f%e3%81%a8%e3%81%88%ef%bd%9e%e3%81%a6%e3%82%82-tatoe-temo-meaning/",
  },
  {
    slug: "toshitara",
    japanese: "としたら・とすれば",
    romaji: "toshitara / tosureba",
    meaning: "if it were the case that",
    level: "N2",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a8%e3%81%99%e3%82%8c%e3%81%b0-%e3%81%a8%e3%81%97%e3%81%9f%e3%82%89-%e3%81%a8%e3%81%99%e3%82%8b%e3%81%a8-sureba-shitara-suru-to-meaning/",
  },
  {
    slug: "ba-yokatta",
    japanese: "ばよかった",
    romaji: "ba yokatta",
    meaning: "should have; I wish I had",
    level: "N3",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%82%88%e3%81%8b%e3%81%a3%e3%81%9f-ba-yokatta-meaning/",
  },
  {
    slug: "nakereba-naranai",
    japanese: "なければならない",
    romaji: "nakereba naranai",
    meaning: "must; have to",
    level: "N4",
    category: "conditional",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%aa%e3%81%91%e3%82%8c%e3%81%b0%e3%81%aa%e3%82%89%e3%81%aa%e3%81%84-nakereba-naranai-meaning/",
  },

  // Reason/Cause forms
  {
    slug: "kara",
    japanese: "から",
    romaji: "kara",
    meaning: "because; since",
    level: "N5",
    category: "reason",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8b%e3%82%89-kara-meaning/",
  },
  {
    slug: "node",
    japanese: "ので",
    romaji: "node",
    meaning: "because; since (softer)",
    level: "N5",
    category: "reason",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%ae%e3%81%a7-node-meaning/",
  },
  {
    slug: "tame-ni",
    japanese: "ために",
    romaji: "tame ni",
    meaning: "for; in order to; because of",
    level: "N3",
    category: "reason",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%9f%e3%82%81%e3%81%ab-tame-ni-meaning/",
  },
  {
    slug: "okage-de",
    japanese: "おかげで",
    romaji: "okage de",
    meaning: "thanks to; because of",
    level: "N3",
    category: "reason",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%8a%e3%81%8b%e3%81%92%e3%81%a7-okage-de-meaning/",
  },
  {
    slug: "sei-de",
    japanese: "せいで",
    romaji: "sei de",
    meaning: "because of (negative)",
    level: "N3",
    category: "reason",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%9b%e3%81%84%e3%81%a7-sei-de-meaning/",
  },
  {
    slug: "niyotte",
    japanese: "によって・による",
    romaji: "ni yotte / ni yoru",
    meaning: "due to; depending on; by means of",
    level: "N3",
    category: "reason",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%ab%e3%82%88%e3%81%a3%e3%81%a6-%e3%81%ab%e3%82%88%e3%82%8b-ni-yotte-ni-yoru-meaning/",
  },

  // Lexicographically similar forms (look alike but different meanings)
  // Note: たり (tari) excluded - page has stricter bot protection
  {
    slug: "bakari",
    japanese: "ばかり",
    romaji: "bakari",
    meaning: "only; just; nothing but",
    level: "N4",
    category: "lexical",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%b0%e3%81%8b%e3%82%8a-bakari-meaning/",
  },
  {
    slug: "demo",
    japanese: "でも",
    romaji: "demo",
    meaning: "but; however; even",
    level: "N5",
    category: "lexical",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%a7%e3%82%82-demo-meaning/",
  },
  {
    slug: "nagara",
    japanese: "ながら",
    romaji: "nagara",
    meaning: "while doing; although",
    level: "N4",
    category: "lexical",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%aa%e3%81%8c%e3%82%89-nagara-meaning/",
  },
  {
    slug: "youni",
    japanese: "ように",
    romaji: "you ni",
    meaning: "so that; in order to; in such a way",
    level: "N4",
    category: "lexical",
    url: "https://jlptsensei.com/learn-japanese-grammar/ように-ような-you-ni-na-meaning/",
  },
  {
    slug: "youna",
    japanese: "ような",
    romaji: "you na",
    meaning: "like; such as; similar to",
    level: "N4",
    category: "lexical",
    url: "https://jlptsensei.com/learn-japanese-grammar/ように-ような-you-ni-na-meaning/",
  },
  {
    slug: "made",
    japanese: "まで",
    romaji: "made",
    meaning: "until; as far as; to the extent",
    level: "N5",
    category: "lexical",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%be%e3%81%a7-made-meaning/",
  },
  {
    slug: "madeni",
    japanese: "までに",
    romaji: "made ni",
    meaning: "by (deadline); by the time",
    level: "N4",
    category: "lexical",
    url: "https://jlptsensei.com/learn-japanese-grammar/%e3%81%be%e3%81%a7%e3%81%ab-made-ni-meaning/",
  },
];

// ============================================================================
// Browser-based Fetching with Playwright
// ============================================================================

let browser: Browser | null = null;
let page: Page | null = null;

async function initBrowser(): Promise<void> {
  if (browser) return;

  browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });

  page = await context.newPage();
}

async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

// Delay with jitter (6-8 seconds)
function randomDelay(): Promise<void> {
  const base = 6000;
  const jitter = Math.random() * 2000; // 0-2000ms jitter
  return new Promise((resolve) => setTimeout(resolve, base + jitter));
}

async function fetchWithBrowser(url: string): Promise<string> {
  if (!page) {
    await initBrowser();
  }
  if (!page) {
    throw new Error("Failed to initialize browser");
  }

  await randomDelay();

  // Navigate to the page and wait for content
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for main content to be loaded - try to find common grammar page elements
  try {
    await page.waitForSelector(".entry-content, article, main", { timeout: 15000 });
  } catch {
    // Fall back to just waiting for body
    await page.waitForSelector("body", { timeout: 5000 });
  }

  // Give the page a moment for dynamic content
  await page.waitForTimeout(2000);

  // Get the page content
  const html = await page.content();

  // Debug: save HTML to file in test mode
  if (process.argv.includes("--debug")) {
    const fs = await import("node:fs");
    const slug = url.split("/").filter(Boolean).pop() ?? "unknown";
    fs.writeFileSync(`/tmp/jlpt-${slug}.html`, html);
  }

  // Basic check for captcha
  if (html.includes("captcha") && html.length < 5000) {
    throw new Error("Captcha detected - page may need manual verification");
  }

  // Check for 404 page
  if (html.includes("<title>Page not found") || html.includes("Page not found –")) {
    throw new Error("Page not found (404) - URL may be incorrect");
  }

  // Check that we have grammar content
  if (!html.includes("example-cont") && !html.includes("Example")) {
    throw new Error("Page doesn't appear to contain grammar examples");
  }

  return html;
}

// ============================================================================
// HTML Parsing
// ============================================================================

function parseDetailPage(html: string): ParsedDetailPage {
  const $ = cheerio.load(html);
  const result: ParsedDetailPage = {
    examples: [],
    relatedGrammarUrls: [],
  };

  // Extract formation/conjugation rules from the usage table
  const usageTable = $("table.usage, .table.usage");
  if (usageTable.length > 0) {
    const rows: string[] = [];
    usageTable.find("tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const left = $(cells[0]).text().trim();
        const right = $(cells[1]).text().trim();
        if (left && right) {
          rows.push(`${left} + ${right}`);
        }
      }
    });
    if (rows.length > 0) {
      result.formation = rows.join("\n");
    }
  }

  // Extract example sentences from .example-cont divs
  // Structure: .example-cont contains:
  //   - .example-main .jp (Japanese sentence)
  //   - [id$="_en"] .alert-primary (English translation)
  $(".example-cont").each((_, el) => {
    const $el = $(el);

    // Get Japanese text from .example-main .jp
    const japanese = $el.find(".example-main .jp").text().trim();

    // Get English text from the English collapse section
    const english = $el.find('[id$="_en"] .alert-primary, [id$="_en"] .alert').text().trim();

    if (japanese && english) {
      result.examples.push({
        japanese: japanese.replace(/\s+/g, " "),
        english: english.replace(/\s+/g, " "),
      });
    }
  });

  // Fallback: Try table-based examples if no .example-cont found
  if (result.examples.length === 0) {
    $(".wp-block-table tbody tr, table.example-table tbody tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const japanese = $(cells[0]).text().trim();
        const english = $(cells[1]).text().trim();
        if (
          japanese &&
          english &&
          !japanese.toLowerCase().includes("verb") &&
          !japanese.toLowerCase().includes("adjective") &&
          !japanese.toLowerCase().includes("noun")
        ) {
          result.examples.push({ japanese, english });
        }
      }
    });
  }

  // Extract related grammar links from the related grammar section
  $('a[href*="/learn-japanese-grammar/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.includes("/learn-japanese-grammar/") && !href.includes("#")) {
      // Normalize URL
      const fullUrl = href.startsWith("http") ? href : `https://jlptsensei.com${href}`;
      // Avoid duplicates
      if (!result.relatedGrammarUrls.includes(fullUrl)) {
        result.relatedGrammarUrls.push(fullUrl);
      }
    }
  });

  return result;
}

// ============================================================================
// Main Scraper
// ============================================================================

interface ScrapeContext {
  completed: number;
  total: number;
  errors: string[];
}

async function scrapeTargetGrammar(): Promise<void> {
  // Check for test mode (--test or -t flag) or --count=N
  const isTestMode = process.argv.includes("--test") || process.argv.includes("-t");
  const countArg = process.argv.find((arg) => arg.startsWith("--count="));
  const testCount = countArg ? parseInt(countArg.split("=")[1] ?? "2", 10) : (isTestMode ? 2 : TARGET_GRAMMAR.length);

  // Check for gum and show message if not installed
  await checkGumOrPrompt();

  // Display header
  const subtitle = testCount < TARGET_GRAMMAR.length
    ? `TEST MODE - ${testCount} items only`
    : "Conditionals & Reason/Cause Forms";
  await styledHeader("JLPTSensei Grammar Scraper", subtitle);

  console.log();
  console.log("  Using Playwright browser for scraping...");
  console.log();

  // Limit to 2 items in test mode
  const grammarToScrape = TARGET_GRAMMAR.slice(0, testCount);

  // Open database
  const db = openDatabase();
  const context: ScrapeContext = {
    completed: 0,
    total: grammarToScrape.length,
    errors: [],
  };

  // Initialize browser
  await initBrowser();

  // Create tasks for listr2
  const tasks = new Listr<ScrapeContext>(
    grammarToScrape.map((grammar): ListrTask<ScrapeContext> => ({
      title: `${grammar.japanese} (${grammar.romaji}) - ${grammar.meaning}`,
      task: async (ctx, task) => {
        // Check if this grammar point already exists
        if (grammarPointExists(db, grammar.slug)) {
          task.title = `${grammar.japanese} (${grammar.romaji}) - skipped (exists)`;
          return;
        }

        // Check if this URL appears in existing related_grammar
        // (meaning an existing item considers this one "related")
        const relatedFromIds = findGrammarPointsWithRelatedUrl(db, grammar.url);

        try {
          // Fetch the page
          task.title = `Fetching ${grammar.japanese} (${grammar.romaji})...`;
          const html = await fetchWithBrowser(grammar.url);

          // Parse the content
          task.title = `Parsing ${grammar.japanese} (${grammar.romaji})...`;
          const parsed = parseDetailPage(html);

          // Store in database
          const grammarId = upsertGrammarPoint(db, {
            slug: grammar.slug,
            japanese: grammar.japanese,
            romaji: grammar.romaji,
            meaning: grammar.meaning,
            level: grammar.level,
            category: grammar.category,
            detailUrl: grammar.url,
            ...(parsed.formation ? { formation: parsed.formation } : {}),
          });

          replaceExamples(db, grammarId, parsed.examples, "jlptsensei.com");
          replaceRelatedGrammar(db, grammarId, parsed.relatedGrammarUrls);

          // If this item was found in existing related_grammar, create lexical similarity links
          for (const existingId of relatedFromIds) {
            addLexicalSimilarity(db, existingId, grammarId);
          }

          ctx.completed++;
          const lexicalNote = relatedFromIds.length > 0 ? ` [+${relatedFromIds.length} lexical]` : "";
          task.title = `${grammar.japanese} (${grammar.romaji}) - ${parsed.examples.length} examples${lexicalNote}`;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          ctx.errors.push(`${grammar.slug}: ${msg}`);
          throw new Error(`Failed: ${msg}`);
        }
      },
    })),
    {
      concurrent: false, // Sequential to respect rate limiting
      exitOnError: false, // Continue on error
      rendererOptions: {
        collapseSubtasks: false,
      },
    }
  );

  // Run the scraper
  try {
    await tasks.run(context);
  } catch {
    // Errors are already captured in context
  }

  // Close browser
  await closeBrowser();

  console.log();

  // Export to JSON
  const outputPath = exportToJson(db);

  // Get final stats
  const stats = getStats(db);

  // Display summary
  await formatSummary({
    grammarPointsScraped: stats.grammarCount,
    exampleSentences: stats.exampleCount,
    relatedGrammarLinks: stats.relatedCount,
    lexicalSimilarities: stats.lexicalCount,
    outputPath,
  });

  // Show errors if any
  if (context.errors.length > 0) {
    console.log("\nErrors encountered:");
    for (const error of context.errors) {
      console.log(`  ✗ ${error}`);
    }
  }

  // Close database
  db.close();
}

// Run if executed directly
scrapeTargetGrammar().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
