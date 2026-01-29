import { HfInference } from "@huggingface/inference";

// Initialize with your Hugging Face token (set HF_TOKEN env var)
const hf = new HfInference(process.env.HF_TOKEN);

async function main() {
  console.log("AI-Enhanced Text Search Explorer");
  console.log("================================\n");

  // Example: Generate embeddings for semantic search
  const texts = [
    "The quick brown fox jumps over the lazy dog",
    "A fast auburn canine leaps above a sleepy hound",
    "The weather is nice today",
  ];

  console.log("Generating embeddings for sample texts...\n");

  for (const text of texts) {
    console.log(`Text: "${text}"`);

    // Using a popular sentence embedding model
    const embedding = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });

    console.log(`Embedding dimensions: ${(embedding as number[]).length}`);
    console.log(`First 5 values: [${(embedding as number[]).slice(0, 5).map(n => n.toFixed(4)).join(", ")}...]`);
    console.log();
  }
}

main().catch(console.error);
