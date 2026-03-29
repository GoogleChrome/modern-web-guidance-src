import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from "url";
import { classifyGuide, scanAllGuides } from "../../harness/lib/utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT_DIR, "benchmarks/data");
const OUTPUT_FILE = path.join(DATA_DIR, "eval-queries-pool.json");

// Define a type for our evaluation queries
export interface EvalQuery {
  guideId: string;
  category: string;
  query: string;
}

// Simple wrapper for Gemini API
async function generateQueriesWithGemini(markdownContent: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }

  const prompt = `You are a web developer trying to implement a specific UI pattern or Web Platform feature. 
Based on the following guide, generate exactly 50 realistic queries you might use to search for this best practice.

CRITICAL CONSTRAINTS:
- Action-oriented description of the desired use case (e.g., 'lazy load images' or 'show a tooltip on hover'). 
- Avoid 'how to' questions and single-keyword queries (e.g. 'images'). 
- Capture the abstract, high-level use case, while avoiding content-specific details (e.g. 'display a carousel of images' instead of 'swipe through historical portraits').

Format the output as a strict JSON array of strings. Do not include markdown blocks or any other text.
Example format:
["lazy load images", "defer rendering offscreen elements", "show tooltip on hover", "animate entry transitions"]

Guide Content:
${markdownContent.substring(0, 3000)}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rawText) {
    throw new Error("Failed to parse response text from Gemini API.");
  }

  try {
    const list: string[] = JSON.parse(rawText);
    if (!Array.isArray(list)) throw new Error("Parsed JSON is not an array");
    return list;
  } catch {
    throw new Error(`Failed to parse JSON array from Gemini output: ${rawText}`);
  }
}

async function main() {
  const allQueries: EvalQuery[] = [];

  console.log("Scanning for eval-ready guides...");
  const readyGuides = scanAllGuides().filter(inv => classifyGuide(inv) === 'eval-ready');

  if (readyGuides.length === 0) {
    console.log("No eval-ready guides found.");
    return;
  }

  for (const inv of readyGuides) {
    const guidePath = path.join(inv.dir, "guide.md");
    if (!fs.existsSync(guidePath)) continue;

    console.log(`Processing guide: ${inv.name} (${inv.category})...`);
    
    // Read and strip frontmatter to give cleaner context to LLM
    const content = fs.readFileSync(guidePath, "utf-8");
    const { content: markdownBody } = matter(content);

    try {
      const generatedStrings = await generateQueriesWithGemini(markdownBody);
      
      for (const str of generatedStrings) {
        allQueries.push({
          guideId: inv.name,
          category: inv.category,
          query: str
        });
      }
      console.log(`  -> Generated ${generatedStrings.length} queries.`);
    } catch (e: any) {
      console.error(`  -> Failed generation for ${inv.name}: ${e.message}`);
    }
    
    // Slight pause to avoid spamming the rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  // Ensure output directory exists before saving
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allQueries, null, 2));
  console.log(`\nSuccessfully generated ${allQueries.length} total queries saved to: ${OUTPUT_FILE}`);
}

if (process.argv[1] === __filename) {
  main().catch(console.error);
}
