import fs from "fs";
import path from "path";
import zlib from "zlib";
import matter from "gray-matter";
import { marked } from "marked";
import { parseArgs } from "node:util";

export interface StoreUseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  chunkContent?: string;
  vector?: number[];
  distance?: number;
}
import { replaceMacros, type BuildTarget } from "../lib/macros.ts";

import { scanAllGuides, type GuideInventory } from "../../lib/guide-validation.ts";
import { getFeatureName } from "../lib/baseline.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "lib/use-cases.gen.ts");

interface UseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
}

export interface BuildOptions {
  outputDir: string;
  target?: BuildTarget;
  subset?: number;
  force?: boolean;
  targetGuidePath?: string;
  modelName?: string;
  noChunking?: boolean;
}

// Global variables to be set by processGuides
let BUILD_GUIDES_DIR: string;
let VECTORS_FILE: string;
let IS_NO_CHUNKING = false;
let TARGET: BuildTarget = 'local-dev';


export async function processGuides(opts: BuildOptions) {
  const { outputDir, target, subset, force, targetGuidePath, modelName, noChunking } = opts;

  BUILD_GUIDES_DIR = path.join(outputDir, "guides");
  VECTORS_FILE = (target === 'skills-cli')
    ? path.join(outputDir, "use-cases.vectors.gen.json.gz")
    : path.join(ROOT_DIR, "lib/use-cases.vectors.gen.json.gz");

  IS_NO_CHUNKING = !!noChunking;
  TARGET = target || 'local-dev';

  // Scan guides first to see if we even need to run
  let readyGuides = scanAllGuides().filter(inv => inv.hasGuide);

  if (subset) {
    readyGuides = readyGuides.slice(0, subset);
    console.log(`Building a subset of ${readyGuides.length} guides.`);
  }

  let shouldSkip = !process.env.CI && !targetGuidePath && !force && fs.existsSync(OUTPUT_FILE) && fs.existsSync(BUILD_GUIDES_DIR) && fs.existsSync(VECTORS_FILE);

  if (shouldSkip) {
    // Also check if the count of files in BUILD_GUIDES_DIR matches readyGuides.length
    const countFiles = (dir: string): number => {
      let count = 0;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          count += countFiles(path.join(dir, entry.name));
        } else if (entry.name.endsWith(".md")) {
          count++;
        }
      }
      return count;
    };

    if (countFiles(BUILD_GUIDES_DIR) !== readyGuides.length) {
      shouldSkip = false;
    }
  }

  if (shouldSkip) {
    const outputFileMTime = Math.min(
      fs.statSync(OUTPUT_FILE).mtimeMs,
      fs.statSync(VECTORS_FILE).mtimeMs
    );
    let anyGuideNewer = false;

    if (fs.statSync(import.meta.filename).mtimeMs > outputFileMTime) {
      anyGuideNewer = true;
    } else {
      for (const inv of readyGuides) {
        const guidePath = path.join(inv.dir, "guide.md");
        if (fs.existsSync(guidePath) && fs.statSync(guidePath).mtimeMs > outputFileMTime) {
          anyGuideNewer = true;
          break;
        }
      }
    }

    if (!anyGuideNewer) {
      // No guides or script modified since last build. Skipping guide build
      console.log("👌");
      return;
    }
  }

  // Ensure clean build/guides exists
  if (fs.existsSync(BUILD_GUIDES_DIR)) {
    fs.rmSync(BUILD_GUIDES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(BUILD_GUIDES_DIR, { recursive: true });

  const useCases: UseCase[] = [];
  const storeUseCases: StoreUseCase[] = [];

  console.log("Initializing Embedder...");

  if (modelName) {
    console.log(`Using custom embedding model: ${modelName}`);
  }

  const { Embedder } = await import("../lib/transformers-embedder.ts");
  const embedder = Embedder.getInstance(modelName);
  await embedder.init();

  if (targetGuidePath) {
    // Single guide mode
    const absoluteTargetPath = path.resolve(ROOT_DIR, "..", targetGuidePath);
    console.log(`Building single guide from: ${absoluteTargetPath}`);

    const guidePath = path.join(absoluteTargetPath, "guide.md");
    if (!fs.existsSync(guidePath)) {
      throw new Error(`guide.md not found in ${absoluteTargetPath}.`);
    }

    const category = path.basename(path.dirname(absoluteTargetPath));
    const name = path.basename(absoluteTargetPath);
    readyGuides = [{dir: absoluteTargetPath, name, category, hasGuide: true} as GuideInventory];
  }

  console.log("Generating embeddings…");
  for (const inv of readyGuides) {
    const guidePath = path.join(inv.dir, "guide.md");
    await processSingleGuideFile(guidePath, inv.category, inv.name, useCases, storeUseCases, embedder);
  }

  console.log("Scanning for category skills (SKILL.md)...");
  const guidesDirInRoot = path.join(ROOT_DIR, "../guides");
  if (fs.existsSync(guidesDirInRoot)) {
    const candidates = fs.readdirSync(guidesDirInRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
      .map(d => d.name);

    for (const candidate of candidates) {
      const skillSource = path.join(guidesDirInRoot, candidate, "SKILL.md");
      if (fs.existsSync(skillSource)) {
        await processSingleGuideFile(skillSource, candidate, candidate, useCases, storeUseCases, embedder);
      }
    }
  }

  // Generate TypeScript file
  const tsContent = `// This file is auto-generated by scripts/build-guides.ts
export interface UseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
}

export const USE_CASES: UseCase[] = ${JSON.stringify(useCases, null, 2)};
`;

  fs.writeFileSync(OUTPUT_FILE, tsContent);
  console.log(`Generated ${useCases.length} use cases to ${OUTPUT_FILE}`);


  const jsonContent = JSON.stringify(storeUseCases);
  const compressed = zlib.gzipSync(jsonContent);
  fs.writeFileSync(VECTORS_FILE, compressed);
  console.log(`Vector storage updated at ${VECTORS_FILE}`);

}

export function chunkMarkdown(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const token of tokens) {
    if (token.type === 'heading') {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n\n"));
        currentChunk = [];
      }
      currentChunk.push(token.raw);
    } else {
      currentChunk.push(token.raw);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

async function processSingleGuideFile(
  filePath: string,
  category: string,
  id: string,
  useCases: UseCase[],
  storeUseCases: StoreUseCase[],
  embedder: any
) {
  const content = fs.readFileSync(filePath, "utf-8");
  const { data, content: markdownBody, matter: frontmatter } = matter(content, {});

  if (!data.description || !frontmatter) {
    throw new Error(`Missing frontmatter or description in ${filePath}`);
  }

  if (markdownBody.trim().length === 0) {
    // Just a stub guide. No content to index.
    return;
  }

  const processedMarkdown = replaceMacros(markdownBody, filePath, { target: TARGET });

  const featureIds: string[] = data['web-feature-ids'] || [];
  const featuresUsed = featureIds.map(getFeatureName);

  useCases.push({
    id,
    description: data.description,
    category,
    featuresUsed,
  });

  const chunks = IS_NO_CHUNKING
    ? [`${frontmatter}\n\n${processedMarkdown}`]
    : [...chunkMarkdown(processedMarkdown), frontmatter];

  for (const chunk of chunks) {
    const embeddingText = `${id} (${category})\n\n${chunk}`;
    const vector = await embedder.embed(embeddingText);

    storeUseCases.push({
      id,
      description: data.description,
      category,
      featuresUsed,
      chunkContent: chunk,
      vector
    });
  }

  // Create category dir in build/guides
  const buildCategoryDir = path.join(BUILD_GUIDES_DIR, category);
  if (!fs.existsSync(buildCategoryDir)) {
    fs.mkdirSync(buildCategoryDir, { recursive: true });
  }

  // Write clean markdown to build dir
  const buildFilePath = path.join(buildCategoryDir, `${id}.md`);
  fs.writeFileSync(buildFilePath, processedMarkdown.trimStart());
}

// Only run automatically if executed directly
if (process.argv[1] === import.meta.filename) {
  const options = {
    force: { type: 'boolean' as const },
    subset: { type: 'string' as const },
    model: { type: 'string' as const },
    'no-chunking': { type: 'boolean' as const },
  };

  const { values, positionals } = parseArgs({ options, allowPositionals: true });

  const targetGuidePath = positionals[0];
  const force = values.force;
  const noChunking = values['no-chunking'];
  const modelName = values.model;
  const subset = values.subset ? parseInt(values.subset, 10) : undefined;

  processGuides({
    outputDir: path.join(ROOT_DIR, "build"),
    force,
    subset,
    targetGuidePath,
    modelName,
    noChunking
  }).catch(console.error);
}
