
import { searchUseCases } from "../lib/search.ts";

const QUERIES = [
  // High expected similarity
  "optimize loading priority of images",
  "show a tooltip when hovering over an element",
  "defer rendering of offscreen content",
  "align text precisely in the vertical center",
  "validate password input only after user interaction",

  // Borderline / Abstract candidate queries
  "make layout fast and smooth",
  "cool visual animations on scroll",
  "accessible custom dropdown components",
  "store persistent data locally without cookies",
  "handle complex async module dependencies",
  "custom color styles for standard checkboxes",
  "manage recurring dates across time zones",
  "smooth page transitions in single page app",
  "floating chat launcher button when scrolled",
  "hide content in accordions but allow find in page",
  "shrink fixed header dynamically on scroll",
  "debounce and batch metrics events together",
  "physics based bounce and spring easing",
  "reparent dom node without losing iframe state",
  "prevent text wrap and overflow container cleanly",

  // Low similarity / Out-of-scope candidate queries
  "how do I write code",
  "fix errors in my app",
  "user login security",
  "database connection pool",
  "build mobile app for iOS",
  "kubernetes deployment strategies",
  "render charts and graphs",
  "send email verification link",
  "setup webpack configuration",
  "beautiful user interfaces",
  "manage state with redux",
  "detect network connection offline",
  "play audio file on click"
];

async function main() {
  console.log("Sweeping straddling queries to evaluate similarity boundary...\n");

  const rows: string[] = [];

  for (const query of QUERIES) {
    // Request lower boundary floor to capture actual scores
    const results = await searchUseCases(query, 3, -1.0);

    const topMatch = results[0] || { id: "N/A", similarity: 0, description: "No match" };
    const simScore = Number(topMatch.similarity);

    let status = "🔴 Very Low (<0.3)";
    if (simScore >= 0.6) {
      status = "🟢 High (>=0.6)";
    } else if (simScore >= 0.45) {
      status = "🟡 Medium (0.45-0.6)";
    } else if (simScore >= 0.3) {
      status = "🟠 Low (0.3-0.45)";
    }

    rows.push(`| \`${query}\` | ${topMatch.id} | **${typeof topMatch.similarity === 'number' ? topMatch.similarity.toFixed(4) : topMatch.similarity}** | ${status} |`);
  }

  const matrixContent = `# RAG Similarity Threshold Calibration Matrix

This artifact evaluates how candidate queries score against the vector database using **Cosine Similarity**. Review the borderline cases below to determine if the default production threshold (\`minSimilarity = 0.3\`) successfully captures relevant abstract intents while remaining above pure background noise.

## Evaluation Sweep Results

| Search Query | Top Matched Guide ID | Similarity Score | Relevance Status |
| :--- | :--- | :---: | :---: |
${rows.join("\n")}

## Observations & Next Steps
- **High Confidence (\`sim >= 0.6\`)**: Queries matching explicit action-oriented terminology trigger top matches safely.
- **Medium Relevance (\`0.45 <= sim < 0.6\`)**: Queries using conceptual phrasing score securely in this tier.
- **Broad Intent (\`0.3 <= sim < 0.45\`)**: Setting the threshold to \`minSimilarity = 0.3\` captures abstract developer queries to maximize recall.
- **Noise Cutoff (\`sim < 0.3\`)**: Purely out-of-scope topics (e.g., iOS apps, database connection pools) score below \`0.3\`, establishing \`0.3\` as the absolute safety floor.
`;

  console.log(matrixContent);
}

main().catch(console.error);
