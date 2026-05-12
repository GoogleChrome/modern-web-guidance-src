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


interface CachePaths {
  cacheDir: string;
  cachedVectors: string;
  cachedTs: string;
  cachedManifest: string;
  cachedGuides: string;
}

function resolveCachePaths(target: BuildTarget): CachePaths {
  const cacheDir = path.join(WORKSPACE_ROOT, `dist/.cache/${target}`);
  return {
    cacheDir,
    cachedVectors: path.join(cacheDir, "use-cases.vectors.gen.json.gz"),
    cachedTs: path.join(cacheDir, "use-cases.gen.ts"),
    cachedManifest: path.join(cacheDir, "manifest.json"),
    cachedGuides: path.join(cacheDir, "guides"),
  };
}

async function computePipelineHash(guides: GuideInventory[], target: string, noChunking: boolean): Promise<string> {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256");

  hash.update(fs.readFileSync(import.meta.filename, "utf-8"));
  hash.update(target);
  hash.update(noChunking.toString());

  for (const inv of guides) {
    const guidePath = getGuideMarkdownPath(inv);
    if (fs.existsSync(guidePath)) {
      hash.update(path.relative(WORKSPACE_ROOT, guidePath));
      hash.update(fs.readFileSync(guidePath, "utf-8"));
    }
  }
  return hash.digest("hex");
}

function evaluateCacheHit(paths: CachePaths, currentHash: string): boolean {
  if (!fs.existsSync(paths.cachedTs) || !fs.existsSync(paths.cachedVectors) || !fs.existsSync(paths.cachedManifest)) {
    return false;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(paths.cachedManifest, "utf-8"));
    return manifest.hash === currentHash;
  } catch {
    return false;
  }
}

function restoreFromCache(paths: CachePaths, outputDir: string, target: string): void {
  if (target === 'skills-cli') {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.copyFileSync(paths.cachedVectors, path.join(outputDir, "use-cases.vectors.gen.json.gz"));
    fs.cpSync(paths.cachedGuides, path.join(outputDir, "guides"), { recursive: true });
  } else {
    fs.mkdirSync(path.join(ROOT_DIR, "lib"), { recursive: true });
    fs.mkdirSync(path.join(ROOT_DIR, "build"), { recursive: true });
    fs.copyFileSync(paths.cachedVectors, path.join(ROOT_DIR, "lib/use-cases.vectors.gen.json.gz"));
    fs.copyFileSync(paths.cachedTs, OUTPUT_FILE);
    fs.cpSync(paths.cachedGuides, path.join(ROOT_DIR, "build/guides"), { recursive: true });
  }
}

function prepareCleanCacheDir(paths: CachePaths): void {
  if (fs.existsSync(paths.cacheDir)) {
    fs.rmSync(paths.cacheDir, { recursive: true, force: true });
  }
  fs.mkdirSync(paths.cacheDir, { recursive: true });
  fs.mkdirSync(paths.cachedGuides, { recursive: true });
}

export async function processGuides(opts: BuildOptions): Promise<boolean> {
  const { outputDir, target, force, targetGuidePath, modelName, noChunking } = opts;

  TARGET = target || 'local-dev';
  IS_NO_CHUNKING = !!noChunking;

  // 1. Configuration & Paths
  const cachePaths = resolveCachePaths(TARGET);
  BUILD_GUIDES_DIR = cachePaths.cachedGuides;

  // 2. Scan & Hash
  let readyGuides = scanAllGuides().filter(inv => inv.hasGuide);
  const currentHash = await computePipelineHash(readyGuides, TARGET, IS_NO_CHUNKING);

  // 3. Cache Evaluation
  const isHit = !force && !targetGuidePath && evaluateCacheHit(cachePaths, currentHash);
  if (isHit) {
    restoreFromCache(cachePaths, outputDir, TARGET);
    console.log("👌");
    return true; // Skipped
  }

  // 4. Execution Pipeline (Miss)
  prepareCleanCacheDir(cachePaths);

  const useCases: UseCase[] = [];
  const storeUseCases: StoreUseCase[] = [];

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

  fs.writeFileSync(cachePaths.cachedTs, tsContent);
  console.log(`Generated ${useCases.length} use cases to ${path.relative(WORKSPACE_ROOT, cachePaths.cachedTs)}`);


  const jsonContent = JSON.stringify(storeUseCases);
  const compressed = zlib.gzipSync(jsonContent);
  fs.writeFileSync(cachePaths.cachedVectors, compressed);

  fs.writeFileSync(cachePaths.cachedManifest, JSON.stringify({ hash: currentHash }, null, 2));

  restoreFromCache(cachePaths, outputDir, TARGET);
  return false;
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
