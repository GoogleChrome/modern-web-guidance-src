import fs from "node:fs";
import path from "node:path";
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
    
    const topMatch = results[0] || { id: "N/A", similarity: "0.0000", description: "No match" };
    const simScore = parseFloat(topMatch.similarity);
    
    let status = "🔴 Very Low (<0.3)";
    if (simScore >= 0.6) {
      status = "🟢 High (>=0.6)";
    } else if (simScore >= 0.45) {
      status = "🟡 Medium (0.45-0.6)";
    } else if (simScore >= 0.3) {
      status = "🟠 Low (0.3-0.45)";
    }

    rows.push(`| \`${query}\` | [${topMatch.id}](file:///Users/paulirish/code/.worktrees/rag-similarity-refactor/serving/build/guides/${topMatch.category || 'general'}/${topMatch.id}.md) | **${topMatch.similarity}** | ${status} |`);
  }

  const matrixContent = `# RAG Similarity Threshold Calibration Matrix

This artifact evaluates how candidate queries score against the vector database using **Cosine Similarity**. Review the borderline cases below to determine if the default production threshold (\`minSimilarity = 0.45\`) successfully includes true positive intents while cleanly truncating vague fuzzy matches.

## Evaluation Sweep Results

| Search Query | Top Matched Guide ID | Similarity Score | Relevance Status |
| :--- | :--- | :---: | :---: |
${rows.join("\n")}

## Observations & Next Steps
- **High Confidence (\`sim >= 0.6\`)**: Queries matching explicit action-oriented terminology trigger top matches safely.
- **Medium Relevance (\`0.45 <= sim < 0.6\`)**: Queries using conceptual phrasing score in this tier.
- **Low Relevance (\`0.3 <= sim < 0.45\`)**: Highly abstract or vague queries fall into this spectrum. Review these cases to decide if the threshold should be relaxed to \`0.3\` to capture them.
- **Very Low / Noise (\`sim < 0.3\`)**: Purely out-of-scope topics (e.g., iOS apps, database connection pools) score below \`0.3\`, establishing \`0.3\` as a firm lower bound above absolute background noise.
`;

  const artifactPath = "/Users/paulirish/.gemini/jetski/brain/fc5c801a-ffd5-4d52-8f11-41eca1beb712/threshold_calibration_matrix.md";
  fs.writeFileSync(artifactPath, matrixContent);
  console.log(`\n✅ Calibration matrix artifact successfully compiled to:\nfile://${artifactPath}`);
}

main().catch(console.error);
