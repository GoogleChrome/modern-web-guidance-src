import fs from "fs";
import path from "path";
import zlib from "zlib";
import matter from "gray-matter";
import { marked } from "marked";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

export interface StoreUseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  tokenCount?: number;
  chunkContent?: string;
  vector?: number[];
  distance?: number;
}

export interface StaticSiteGuideMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  webFeatureIds: string[];
}
import { replaceMacros, type BuildTarget } from "../core/macros.ts";

import { scanAllGuides, type GuideInventory, getGuideMarkdownPath, extractH1Heading, stripAllComments, isDraftStub, stripLeadingH1 } from "../core/guide-validation.ts";
import { isTmpFeature } from "../core/feature-parser.ts";
import { config } from "../core/skills-config.ts";
import { getFeatureName } from "../core/baseline.ts";
import { rootDir, outDir } from "../core/paths.ts";
import { toDevsiteMarkdown } from "./devsite-markdown.ts";

const WORKSPACE_ROOT = rootDir;


interface UseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  tokenCount?: number;
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
let TARGET: BuildTarget = 'skills-cli';


interface CachePaths {
  cacheDir: string;
  cachedVectors: string;
  cachedGuidesJson: string;
  cachedManifest: string;
  cachedGuides: string;
}

function resolveCachePaths(target: BuildTarget): CachePaths {
  const cacheDir = path.join(outDir, 'build', target);
  return {
    cacheDir,
    cachedVectors: path.join(cacheDir, "use-cases.vectors.gen.json.gz"),
    cachedGuidesJson: path.join(cacheDir, "guides.json"),
    cachedManifest: path.join(cacheDir, "manifest.json"),
    cachedGuides: path.join(cacheDir, "guides"),
  };
}

function getTransformersVersion(): string {
  try {
    const entry = fileURLToPath(import.meta.resolve("@huggingface/transformers"));
    let dir = path.dirname(entry);
    while (dir !== path.dirname(dir)) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "@huggingface/transformers" && typeof pkg.version === "string") {
          return pkg.version;
        }
      }
      dir = path.dirname(dir);
    }
    throw new Error("Could not find package.json with name '@huggingface/transformers'");
  } catch (err) {
    throw new Error(`Failed to extract @huggingface/transformers version for pipeline hash: ${(err as Error).message}`);
  }
}

async function computePipelineHash(
  guides: GuideInventory[],
  target: string,
  noChunking: boolean,
  modelName?: string
): Promise<string> {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256");

  const deps = [
    import.meta.filename,
    path.join(rootDir, "src/core/macros.ts"),
    path.join(rootDir, "src/rag/transformers-embedder.ts"),
    path.join(rootDir, "src/core/guide-validation.ts"),
    path.join(rootDir, "src/build/devsite-markdown.ts"),
  ];

  for (const dep of deps) {
    hash.update(fs.readFileSync(dep, "utf-8"));
  }

  hash.update(target);
  hash.update(noChunking.toString());

  if (target !== 'static-site') {
    const rawModel = modelName || "Xenova/all-MiniLM-L6-v2";
    const [modelId, dtype = "q8"] = rawModel.split("@");
    hash.update(getTransformersVersion());
    hash.update(modelId);
    hash.update(dtype);
  }

  for (const inv of guides) {
    const guidePath = getGuideMarkdownPath(inv);
    if (fs.existsSync(guidePath)) {
      hash.update(path.relative(WORKSPACE_ROOT, guidePath));
      hash.update(fs.readFileSync(guidePath, "utf-8"));
    }
  }
  return hash.digest("hex");
}

function evaluateCacheHit(paths: CachePaths, currentHash: string, expectedGuides: GuideInventory[], target: BuildTarget): boolean {
  const cacheFiles = target === 'static-site'
    ? [paths.cachedManifest, paths.cachedGuides]
    : [paths.cachedGuidesJson, paths.cachedVectors, paths.cachedManifest, paths.cachedGuides];
  if (cacheFiles.some(file => !fs.existsSync(file))) {
    return false;
  }

  // Verify that all expected guide files are present in the cache
  for (const inv of expectedGuides) {
    const cachedFilePath = path.join(paths.cachedGuides, inv.category, `${inv.name}.md`);
    if (!fs.existsSync(cachedFilePath)) {
      return false;
    }
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(paths.cachedManifest, "utf-8"));
    return manifest.hash === currentHash;
  } catch {
    return false;
  }
}

function restoreFromCache(paths: CachePaths, outputDir: string, target: BuildTarget): void {
  if (path.resolve(outputDir) === path.resolve(paths.cacheDir)) {
    return;
  }
  if (target === 'skills-cli') {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.copyFileSync(paths.cachedVectors, path.join(outputDir, "use-cases.vectors.gen.json.gz"));
    fs.copyFileSync(paths.cachedGuidesJson, path.join(outputDir, "guides.json"));
    fs.cpSync(paths.cachedGuides, path.join(outputDir, "guides"), { recursive: true });
  } else if (target === 'static-site') {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.cpSync(paths.cachedGuides, outputDir, { recursive: true });
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

  TARGET = target || 'skills-cli';
  IS_NO_CHUNKING = !!noChunking;

  // 1. Configuration & Paths
  const cachePaths = resolveCachePaths(TARGET);
  BUILD_GUIDES_DIR = cachePaths.cachedGuides;

  // 2. Scan & Hash
  let readyGuides = scanAllGuides().filter(inv => {
    const excluded = config.monoskill.excludeFromBundling || [];
    return inv.isPublished && !excluded.includes(inv.category) && !excluded.includes(inv.name);
  });
  const currentHash = await computePipelineHash(readyGuides, TARGET, IS_NO_CHUNKING, modelName);

  // 3. Cache Evaluation
  const isHit = !force && !targetGuidePath && evaluateCacheHit(cachePaths, currentHash, readyGuides, TARGET);
  if (isHit) {
    restoreFromCache(cachePaths, outputDir, TARGET);
    console.log("👌");
    return true; // Skipped
  }

  // 4. Execution Pipeline (Miss)
  prepareCleanCacheDir(cachePaths);

  const useCases: UseCase[] = [];
  const storeUseCases: StoreUseCase[] = [];
  const staticSiteGuides: StaticSiteGuideMetadata[] = [];

  let embedder: any = null;
  if (TARGET !== 'static-site') {
    if (modelName) {
      console.log(`Using custom embedding model: ${modelName}`);
    }

    const { Embedder } = await import("../rag/transformers-embedder.ts");
    embedder = Embedder.getInstance(modelName);
    await embedder.init();
  }

  if (targetGuidePath) {
    // Single guide mode
    const absoluteTargetPath = path.resolve(rootDir, targetGuidePath);
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
    await processSingleGuideFile(guidePath, inv.category, inv.name, useCases, storeUseCases, embedder, staticSiteGuides);
  }

  if (TARGET !== 'static-site') {
    fs.writeFileSync(cachePaths.cachedGuidesJson, JSON.stringify(useCases, null, 2) + '\n');
    console.log(`Generated ${useCases.length} use cases to ${path.relative(WORKSPACE_ROOT, cachePaths.cachedGuidesJson)}`);

    const jsonContent = JSON.stringify(storeUseCases);
    const compressed = zlib.gzipSync(jsonContent);
    fs.writeFileSync(cachePaths.cachedVectors, compressed);
  } else {
    const manifestPath = path.join(BUILD_GUIDES_DIR, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(staticSiteGuides, null, 2) + '\n');
    console.log(`Generated static-site manifest with ${staticSiteGuides.length} guides to ${path.relative(WORKSPACE_ROOT, manifestPath)}`);
  }

  fs.writeFileSync(cachePaths.cachedManifest, JSON.stringify({ hash: currentHash }, null, 2));

  restoreFromCache(cachePaths, outputDir, TARGET);
  return false;
}

export function chunkMarkdown(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let hasNonHeadingContent = false;

  for (const token of tokens) {
    if (token.type === 'heading') {
      if (currentChunk.length > 0 && hasNonHeadingContent) {
        chunks.push(currentChunk.join("\n\n"));
        currentChunk = [];
        hasNonHeadingContent = false;
      }
      currentChunk.push(token.raw);
    } else {
      currentChunk.push(token.raw);
      if (token.type !== 'space') {
        hasNonHeadingContent = true;
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

function writeBuiltGuide(category: string, id: string, content: string): string {
  const buildCategoryDir = path.join(BUILD_GUIDES_DIR, category);
  fs.mkdirSync(buildCategoryDir, { recursive: true });
  const buildFilePath = path.join(buildCategoryDir, `${id}.md`);
  fs.writeFileSync(buildFilePath, content);
  return buildFilePath;
}

function requireTitle(title: unknown, filePath: string): string {
  if (typeof title !== "string" || !title.trim()) {
    throw new Error(`Guide has no H1 heading or frontmatter title: ${path.relative(WORKSPACE_ROOT, filePath)}`);
  }
  return title.trim();
}

async function processSingleGuideFile(
  filePath: string,
  category: string,
  id: string,
  useCases: UseCase[],
  storeUseCases: StoreUseCase[],
  embedder?: any,
  staticSiteGuides?: StaticSiteGuideMetadata[]
) {
  const content = fs.readFileSync(filePath, "utf-8");
  const { data, content: markdownBody, matter: frontmatter } = matter(content, {});

  if (stripAllComments(markdownBody).trim().length === 0 || isDraftStub(data.draft)) {
    // Just a stub guide. No content to index.
    return;
  }

  if (!data.description || !frontmatter) {
    throw new Error(`Missing frontmatter or description in ${filePath}`);
  }

  const processedMarkdown = replaceMacros(markdownBody, filePath, { target: TARGET });

  if (TARGET === 'static-site') {
    const h1Title = extractH1Heading(processedMarkdown);
    const title = requireTitle(h1Title || data.title, filePath);
    const featureIds: string[] = (data['web-feature-ids'] || []).filter(
      (fid: string) => !isTmpFeature(fid)
    );
    const genericFrontmatter = `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(data.description)}
category: ${category}
web-feature-ids: ${JSON.stringify(featureIds)}
---`;
    const resumedSteps: number[] = [];
    const devsiteMarkdown = toDevsiteMarkdown(processedMarkdown, stepNumber => resumedSteps.push(stepNumber));
    if (resumedSteps.length > 0) {
      console.warn(`⚠️  ${path.relative(WORKSPACE_ROOT, filePath)}: folded unindented blocks into ordered lists (resumed at steps ${resumedSteps.join(", ")}).`);
    }
    const bodyWithoutH1 = stripLeadingH1(devsiteMarkdown);
    const finalContent = `${genericFrontmatter}\n\n# ${title}\n\n${bodyWithoutH1}\n`;
    const buildFilePath = writeBuiltGuide(category, id, finalContent);
    console.log(`Exported static-site guide: ${path.relative(WORKSPACE_ROOT, buildFilePath)}`);

    if (staticSiteGuides) {
      staticSiteGuides.push({
        id,
        title,
        description: data.description,
        category,
        webFeatureIds: featureIds,
      });
    }
    return;
  }

  const featureIds: string[] = data['web-feature-ids'] || [];
  const featuresUsed = featureIds.map(getFeatureName);
  const tokenCount = await embedder.countTokens(processedMarkdown);

  useCases.push({
    id,
    description: data.description,
    category,
    featuresUsed,
    tokenCount,
  });

  const h1Title = extractH1Heading(processedMarkdown);
  const title = requireTitle(h1Title || data.title, filePath);
  const summaryChunk = `# ${title}\n\n${data.description}`;

  const chunks = IS_NO_CHUNKING
    ? [`${summaryChunk}\n\n${processedMarkdown.trim().replace(/^#\s+[^\n]*\n?/, "")}`]
    : [...chunkMarkdown(processedMarkdown), summaryChunk];

  for (const chunk of chunks) {
    const embeddingText = `${id} (${category})\nFeatures: ${featuresUsed.join(", ")}\n\n${chunk}`;
    const vector = await embedder.embed(embeddingText);

    storeUseCases.push({
      id,
      description: data.description,
      category,
      featuresUsed,
      tokenCount,
      chunkContent: chunk,
      vector
    });
  }

  writeBuiltGuide(category, id, processedMarkdown.trimStart());
}

// Only run automatically if executed directly
if (process.argv[1] === import.meta.filename) {
  const options = {
    force: { type: 'boolean' as const },
    model: { type: 'string' as const },
    'no-chunking': { type: 'boolean' as const },
    target: { type: 'string' as const },
    output: { type: 'string' as const },
  };

  const { values, positionals } = parseArgs({ options, allowPositionals: true });

  const targetGuidePath = positionals[0];
  const force = values.force;
  const noChunking = values['no-chunking'];
  const modelName = values.model;
  const target = (values.target as BuildTarget | undefined) || 'skills-cli';
  const output = values.output;

  processGuides({
    outputDir: output ? path.resolve(WORKSPACE_ROOT, output) : path.join(outDir, "build", target),
    target,
    force,
    targetGuidePath,
    modelName,
    noChunking
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

