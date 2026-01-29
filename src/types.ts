// Grammar point categories
export type GrammarCategory = "conditional" | "reason" | "lexical";

// JLPT levels
export type JLPTLevel = "N1" | "N2" | "N3" | "N4" | "N5";

// Example sentence from scraping
export interface Example {
  id: number;
  japanese: string;
  english: string;
  source: string;
}

// Grammar point stored in database
export interface GrammarPoint {
  id: number;
  slug: string;
  japanese: string;
  romaji: string;
  meaning: string;
  level: JLPTLevel;
  category: GrammarCategory;
  detailUrl: string;
  formation?: string;
  createdAt: string;
  updatedAt: string;
  examples: Example[];
  relatedGrammarUrls: string[];
}

// Target grammar form for scraping (input)
export interface TargetGrammarForm {
  slug: string;
  japanese: string;
  romaji: string;
  meaning: string;
  level: JLPTLevel;
  category: GrammarCategory;
  url: string;
}

// Parsed data from detail page
export interface ParsedDetailPage {
  formation?: string;
  examples: { japanese: string; english: string }[];
  relatedGrammarUrls: string[];
}

// Scrape statistics for summary
export interface ScrapeSummary {
  grammarPointsScraped: number;
  exampleSentences: number;
  relatedGrammarLinks: number;
  lexicalSimilarities: number;
  outputPath: string;
}

// Lexical similarity pair for export
export interface LexicalSimilarityPair {
  grammarIdA: number;
  grammarIdB: number;
}
