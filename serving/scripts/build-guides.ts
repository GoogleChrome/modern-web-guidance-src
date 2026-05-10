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

import { scanAllGuides, type GuideInventory, getGuideMarkdownPath } from "../../lib/guide-validation.ts";
import { getFeatureName } from "../lib/baseline.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = path.resolve(ROOT_DIR, "..");
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
  force?: boolean;
  targetGuidePath?: string;
  modelName?: string;
  noChunking?: boolean;
}

// Global variables to be set by processGuides
let BUILD_GUIDES_DIR: string;
let IS_NO_CHUNKING = false;
let TARGET: BuildTarget = 'local-dev';


export async function processGuides(opts: BuildOptions) {
  const { outputDir, target, force, targetGuidePath, modelName, noChunking } = opts;

  TARGET = target || 'local-dev';
  IS_NO_CHUNKING = !!noChunking;

  const CACHE_DIR = path.join(WORKSPACE_ROOT, `dist/.cache/${TARGET}`);
  const CACHED_VECTORS = path.join(CACHE_DIR, "use-cases.vectors.gen.json.gz");
  const CACHED_TS = path.join(CACHE_DIR, "use-cases.gen.ts");
  const CACHED_MANIFEST = path.join(CACHE_DIR, "manifest.json");
  const CACHED_GUIDES = path.join(CACHE_DIR, "guides");

  BUILD_GUIDES_DIR = CACHED_GUIDES;

  // Scan guides first to see if we even need to run
  let readyGuides = scanAllGuides().filter(inv => inv.hasGuide);

  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256");

  // Bust cache if the build script itself or options change
  hash.update(fs.readFileSync(import.meta.filename, "utf-8"));
  hash.update(TARGET);
  hash.update(IS_NO_CHUNKING.toString());

  for (const inv of readyGuides) {
    const guidePath = getGuideMarkdownPath(inv);
    if (fs.existsSync(guidePath)) {
      hash.update(path.relative(WORKSPACE_ROOT, guidePath));
      hash.update(fs.readFileSync(guidePath, "utf-8"));
    }
  }
  const currentHash = hash.digest("hex");

  let shouldSkip = !targetGuidePath && !force;

  if (shouldSkip) {
    if (!fs.existsSync(CACHED_TS) || !fs.existsSync(CACHED_VECTORS) || !fs.existsSync(CACHED_MANIFEST)) {
      shouldSkip = false;
    } else {
      try {
        const manifest = JSON.parse(fs.readFileSync(CACHED_MANIFEST, "utf-8"));
        if (manifest.hash !== currentHash) {
          shouldSkip = false;
        }
      } catch (e) {
        shouldSkip = false;
      }
    }
  }

  const restoreToTarget = () => {
    if (TARGET === 'skills-cli' || TARGET === 'skills-cli-npx') {
      fs.mkdirSync(outputDir, { recursive: true });
      fs.copyFileSync(CACHED_VECTORS, path.join(outputDir, "use-cases.vectors.gen.json.gz"));
      fs.cpSync(CACHED_GUIDES, path.join(outputDir, "guides"), { recursive: true });
    } else {
      fs.mkdirSync(path.join(ROOT_DIR, "lib"), { recursive: true });
      fs.mkdirSync(path.join(ROOT_DIR, "build"), { recursive: true });
      fs.copyFileSync(CACHED_VECTORS, path.join(ROOT_DIR, "lib/use-cases.vectors.gen.json.gz"));
      fs.copyFileSync(CACHED_TS, OUTPUT_FILE);
      fs.cpSync(CACHED_GUIDES, path.join(ROOT_DIR, "build/guides"), { recursive: true });
    }
  };

  if (shouldSkip) {
    console.log(`⏭️ Cache hit for ${TARGET}. Restoring from ${path.relative(WORKSPACE_ROOT, CACHE_DIR)}...`);
    restoreToTarget();
    console.log("👌");
    return;
  }

  // Miss: clean cache dir
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(CACHED_GUIDES, { recursive: true });

  const useCases: UseCase[] = [];
  const storeUseCases: StoreUseCase[] = [];

  console.log("Initializing Embedder…");

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
    const guidePath = getGuideMarkdownPath(inv);
    await processSingleGuideFile(guidePath, inv.category, inv.name, useCases, storeUseCases, embedder);
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

  fs.writeFileSync(CACHED_TS, tsContent);
  console.log(`Generated ${useCases.length} use cases to ${path.relative(WORKSPACE_ROOT, CACHED_TS)}`);


  const jsonContent = JSON.stringify(storeUseCases);
  const compressed = zlib.gzipSync(jsonContent);
  fs.writeFileSync(CACHED_VECTORS, compressed);
  console.log(`Vector storage updated at ${path.relative(WORKSPACE_ROOT, CACHED_VECTORS)}`);

  fs.writeFileSync(CACHED_MANIFEST, JSON.stringify({ hash: currentHash }, null, 2));

  restoreToTarget();
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
    model: { type: 'string' as const },
    'no-chunking': { type: 'boolean' as const },
  };

  const { values, positionals } = parseArgs({ options, allowPositionals: true });

  const targetGuidePath = positionals[0];
  const force = values.force;
  const noChunking = values['no-chunking'];
  const modelName = values.model;

  processGuides({
    outputDir: path.join(ROOT_DIR, "build"),
    force,
    targetGuidePath,
    modelName,
    noChunking
  }).catch(console.error);
}
