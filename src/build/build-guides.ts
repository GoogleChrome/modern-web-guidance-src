import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execSync } from "node:child_process";
import matter from "@11ty/gray-matter";
import { marked } from "marked";
import { parseArgs } from "node:util";

import { replaceMacros, type BuildTarget } from "../core/macros.ts";
import {
  scanAllGuides,
  type GuideInventory,
  getGuideMarkdownPath,
  extractH1Heading,
  stripAllComments,
  isDraftStub,
  stripLeadingH1,
  getGuideOriginTrials,
} from "../core/guide-validation.ts";
import { isTmpFeature } from "../core/feature-parser.ts";
import { config } from "../core/skills-config.ts";
import { getFeatureName } from "../core/baseline.ts";
import { rootDir, outDir } from "../core/paths.ts";
import { CATEGORIES } from "../core/categories.ts";
import { toDevsiteMarkdown } from "./devsite-markdown.ts";
import type { UseCase } from "../rag/guides.ts";

const WORKSPACE_ROOT = rootDir;

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

export interface DevsiteGuideMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  webFeatureIds: string[];
  refreshDate: string;
  path: string;
}

import type { EmbedderLike } from "../rag/search.ts";
import { loadChunkCache, computeChunkHash } from "../rag/chunk-cache.ts";

export interface BuildOptions {
  outputDir: string;
  target?: BuildTarget;
  force?: boolean;
  targetGuidePath?: string;
  modelName?: string;
  noChunking?: boolean;
  failOnMissingVectors?: boolean;
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

export async function computePipelineHash(
  guides: GuideInventory[],
  target: string,
  noChunking: boolean,
  modelName?: string,
  failOnMissingVectors?: boolean
): Promise<string> {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256");

  const deps = [
    import.meta.filename,
    path.join(rootDir, "src/core/macros.ts"),
    path.join(rootDir, "src/rag/static-embedder.ts"),
    path.join(rootDir, "src/rag/static-model/words.json"),
    path.join(rootDir, "src/rag/static-model/words.i8"),
    path.join(rootDir, "src/rag/static-model/words.scale.f32"),
    path.join(rootDir, "src/rag/chunk-cache.ts"),
    path.join(rootDir, "src/rag/static-model/chunks.json"),
    path.join(rootDir, "src/rag/static-model/chunks.i8"),
    path.join(rootDir, "src/rag/static-model/chunks.scale.f32"),
    path.join(rootDir, "src/core/guide-validation.ts"),
    path.join(rootDir, "features/origin-trials.json"),
    path.join(rootDir, "src/build/devsite-markdown.ts"),
    path.join(rootDir, "src/core/categories.ts"),
    path.join(rootDir, "src/core/headings.ts"),
  ];

  for (const dep of deps) {
    if (fs.existsSync(dep)) {
      hash.update(fs.readFileSync(dep));
    }
  }

  hash.update(target);
  if (target === 'devsite') hash.update(loadGitFileDates().sourceCommit);
  hash.update(noChunking.toString());
  hash.update(Boolean(failOnMissingVectors).toString());

  if (target !== 'devsite') {
    const rawModel = modelName || "static-tokenlearn-256d";
    hash.update(rawModel);
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
  if (target === 'devsite') {
    const devsiteFiles = [
      paths.cachedManifest,
      path.join(paths.cachedGuides, 'index.md'),
      path.join(paths.cachedGuides, '_toc.yaml'),
    ];
    if (devsiteFiles.some(file => !fs.existsSync(file))) {
      return false;
    }
  } else {
    const cacheFiles = [paths.cachedGuidesJson, paths.cachedVectors, paths.cachedGuides];
    if (cacheFiles.some(file => !fs.existsSync(file))) {
      return false;
    }
  }

  // Verify that all expected guide files are present in the cache
  for (const inv of expectedGuides) {
    const cachedFilePath = path.join(paths.cachedGuides, inv.category, `${inv.name}.md`);
    if (!fs.existsSync(cachedFilePath)) {
      return false;
    }
  }

  try {
    const pipelineManifest = path.join(paths.cacheDir, "pipeline.manifest.json");
    if (!fs.existsSync(pipelineManifest)) return false;
    const manifest = JSON.parse(fs.readFileSync(pipelineManifest, "utf-8"));
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
  } else if (target === 'devsite') {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.cpSync(paths.cachedGuides, path.join(outputDir, "guides"), { recursive: true });
    fs.copyFileSync(paths.cachedManifest, path.join(outputDir, "manifest.json"));
  }
}

function prepareCleanCacheDir(paths: CachePaths): void {
  if (fs.existsSync(paths.cacheDir)) {
    fs.rmSync(paths.cacheDir, { recursive: true, force: true });
  }
  fs.mkdirSync(paths.cacheDir, { recursive: true });
  fs.mkdirSync(paths.cachedGuides, { recursive: true });
}

export interface GitInfo {
  fileDates: Map<string, string>;
  sourceCommit: string;
}

export function loadGitFileDates(): GitInfo {
  const fileDates = new Map<string, string>();
  let sourceCommit = "unknown";
  try {
    sourceCommit = execSync("git rev-parse HEAD", { cwd: WORKSPACE_ROOT, encoding: "utf-8" }).trim();
    const raw = execSync('git log --format="COMMIT %cs" --name-only HEAD -- guides/ features/', {
      cwd: WORKSPACE_ROOT,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
    let currentDate = "";
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("COMMIT ")) {
        currentDate = trimmed.slice(7);
        continue;
      }
      if (currentDate && !fileDates.has(trimmed)) {
        fileDates.set(trimmed, currentDate);
      }
    }
  } catch {
    // If not in git or command fails, return fallback
  }
  return { fileDates, sourceCommit };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCardDescription(desc: string): string {
  const escaped = escapeHtml(desc);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function formatMonthDayYear(isoDate: string): string {
  const [year, monthStr, dayStr] = isoDate.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthIndex = parseInt(monthStr, 10) - 1;
  const month = monthNames[monthIndex] ?? monthStr;
  const day = parseInt(dayStr, 10);
  return `${month} ${day}, ${year}`;
}

export function generateGuidesIndex(
  guides: DevsiteGuideMetadata[],
  latestDate: string
): string {
  const latestFormattedDate = formatMonthDayYear(latestDate);
  const lines = [
    'project_path: /docs/modern-web-guidance/_project.yaml',
    'book_path: /docs/modern-web-guidance/_book.yaml',
    `refresh_date: ${latestDate}`,
    'description: An interactive directory of guides in Modern Web Guidance.',
    'author: Chrome DevRel',
    'image_path: image/cover.png',
    'keywords: googleai,category:AiAndMachineLearning',
    '',
    '<!-- This page is generated by npm run build:devsite. Do not edit manually. -->',
    '',
    '<link rel="stylesheet" href="/docs/modern-web-guidance/landing.css">',
    '',
    '{% import "/_macros.html" as macros %}',
    '',
    '# Modern Web Guidance guides',
    '',
    `{{ macros.Date('${latestFormattedDate}') }}`,
    '',
    '{% include "/docs/modern-web-guidance/_guide-promo.html" %}',
    '',
    'Explore the guides available in Modern Web Guidance organized by category.',
    '',
  ];

  for (const { slug, title: catTitle } of CATEGORIES) {
    const guidesInCat = guides.filter(g => g.category === slug);
    if (guidesInCat.length === 0) continue;
    guidesInCat.sort((a, b) => a.title.localeCompare(b.title));

    lines.push(`## ${catTitle}\n`);
    lines.push('<div class="guidance-card-grid">');

    for (const g of guidesInCat) {
      const cardHtml = [
        `  <a class="guidance-card" href="/docs/modern-web-guidance/guides/${slug}/${g.id}">`,
        `    <div class="guidance-card-title">${escapeHtml(g.title)}</div>`,
      ];
      if (g.description) {
        cardHtml.push(`    <div class="guidance-card-desc">${formatCardDescription(g.description)}</div>`);
      }
      cardHtml.push('  </a>');
      lines.push(cardHtml.join('\n'));
    }

    lines.push('</div>\n');
  }

  return lines.join('\n') + '\n';
}

export function generateGuidesTocYaml(guides: DevsiteGuideMetadata[]): string {
  const lines = [
    '# This file is generated by npm run build:devsite. Do not edit manually.',
    'toc:',
    '- title: All guides',
    '  path: /docs/modern-web-guidance/guides',
    '',
  ];

  for (const { slug, title: catTitle } of CATEGORIES) {
    const guidesInCat = guides.filter(g => g.category === slug);
    if (guidesInCat.length === 0) continue;
    guidesInCat.sort((a, b) => a.title.localeCompare(b.title));

    lines.push(`- heading: ${catTitle}`);
    for (const g of guidesInCat) {
      lines.push(`- title: ${JSON.stringify(g.title)}`);
      lines.push(`  path: /docs/modern-web-guidance/guides/${slug}/${g.id}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export async function processGuides(opts: BuildOptions): Promise<boolean> {
  const { outputDir, target, force, targetGuidePath, modelName, noChunking, failOnMissingVectors } = opts;

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
  const currentHash = await computePipelineHash(
    readyGuides,
    TARGET,
    IS_NO_CHUNKING,
    modelName,
    failOnMissingVectors
  );

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
  const devsiteGuides: DevsiteGuideMetadata[] = [];
  const gitInfo = TARGET === 'devsite' ? loadGitFileDates() : { fileDates: new Map(), sourceCommit: "unknown" };

  let embedder: EmbedderLike | undefined;
  if (TARGET !== 'devsite') {
    if (modelName) {
      console.log(`Using custom embedding model: ${modelName}`);
      const { Embedder } = await import("../rag/transformers-embedder.ts");
      const inst = Embedder.getInstance(modelName);
      await inst.init();
      embedder = inst;
    } else {
      const { StaticEmbedder } = await import("../rag/static-embedder.ts");
      const inst = StaticEmbedder.getInstance();
      inst.init();
      embedder = inst;
    }
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

  const chunkCache = TARGET !== 'devsite' && !modelName ? loadChunkCache() : null;
  const missingChunks: Array<{ guideId: string; category: string; chunk: string }> = [];

  console.log(TARGET === 'devsite' ? "Exporting DevSite guides…" : "Generating embeddings…");
  for (const inv of readyGuides) {
    const guidePath = getGuideMarkdownPath(inv);
    await processSingleGuideFile(
      guidePath,
      inv.category,
      inv.name,
      useCases,
      storeUseCases,
      embedder,
      devsiteGuides,
      gitInfo,
      modelName,
      chunkCache,
      missingChunks
    );
  }

  if (missingChunks.length > 0) {
    const missingGuides = [...new Set(missingChunks.map((m) => m.guideId))];
    console.warn(
      `\n⚠️  WARNING: ${missingChunks.length} chunk(s) across ${missingGuides.length} guide(s) lack cached teacher vectors:`
    );
    for (const g of missingGuides) {
      console.warn(`   - ${g}`);
    }
    console.warn(
      `   These chunks are indexed for BM25 search only. Run 'node src/rag/embed-chunks.ts' to embed them.\n`
    );

    if (failOnMissingVectors) {
      throw new Error(
        `Release check failed: ${missingChunks.length} chunk(s) across ${missingGuides.length} guide(s) lack cached teacher vectors. Run 'node src/rag/embed-chunks.ts' before release.`
      );
    }
  }

  if (TARGET === 'skills-cli') {
    fs.writeFileSync(cachePaths.cachedGuidesJson, JSON.stringify(useCases, null, 2) + '\n');
    console.log(`Generated ${useCases.length} use cases to ${path.relative(WORKSPACE_ROOT, cachePaths.cachedGuidesJson)}`);

    const jsonContent = JSON.stringify(storeUseCases);
    const compressed = zlib.gzipSync(jsonContent);
    fs.writeFileSync(cachePaths.cachedVectors, compressed);
  } else if (TARGET === 'devsite') {
    const latestGuideDate = devsiteGuides.reduce(
      (max, g) => (g.refreshDate > max ? g.refreshDate : max),
      '2026-01-01'
    );

    const indexContent = generateGuidesIndex(devsiteGuides, latestGuideDate);
    fs.writeFileSync(path.join(BUILD_GUIDES_DIR, 'index.md'), indexContent);

    const tocContent = generateGuidesTocYaml(devsiteGuides);
    fs.writeFileSync(path.join(BUILD_GUIDES_DIR, '_toc.yaml'), tocContent);

    const manifestPath = path.join(cachePaths.cacheDir, 'manifest.json');
    const manifest = {
      generatedAt: new Date().toISOString(),
      sourceCommit: gitInfo.sourceCommit,
      guides: devsiteGuides,
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Generated DevSite target with ${devsiteGuides.length} guides`);
  }

  if (missingChunks.length === 0) {
    fs.writeFileSync(
      path.join(cachePaths.cacheDir, "pipeline.manifest.json"),
      JSON.stringify({ hash: currentHash }, null, 2) + '\n'
    );
  } else {
    console.warn(
      `⚠️  Skipped writing build cache manifest due to ${missingChunks.length} missing teacher vector(s).`
    );
  }

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
  embedder?: EmbedderLike,
  devsiteGuides?: DevsiteGuideMetadata[],
  gitInfo?: GitInfo,
  modelName?: string,
  chunkCache?: Map<string, Float32Array> | null,
  missingChunks?: Array<{ guideId: string; category: string; chunk: string }>
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

  const includedFiles = new Set<string>();
  const processedMarkdown = replaceMacros(markdownBody, filePath, { target: TARGET, includedFiles });

  if (TARGET === 'devsite') {
    const h1Title = extractH1Heading(processedMarkdown);
    const title = requireTitle((typeof data.title === 'string' && data.title.trim()) || h1Title, filePath);
    const featureIds: string[] = (data['web-feature-ids'] || []).filter(
      (fid: string) => !isTmpFeature(fid)
    );

    // Compute refresh_date: max date of guide file and any included files
    const relGuidePath = path.relative(WORKSPACE_ROOT, filePath);
    let refreshDate = gitInfo?.fileDates.get(relGuidePath);
    for (const inc of includedFiles) {
      const relInc = path.relative(WORKSPACE_ROOT, inc);
      const incDate = gitInfo?.fileDates.get(relInc);
      if (incDate && (!refreshDate || incDate > refreshDate)) {
        refreshDate = incDate;
      }
    }
    if (!refreshDate) {
      refreshDate = new Date().toISOString().slice(0, 10);
    }

    const cleanDesc = String(data.description || "").replace(/\r\n/g, " ").replace(/\n/g, " ").trim();

    const devsiteFrontmatter = [
      'project_path: /docs/modern-web-guidance/_project.yaml',
      'book_path: /docs/modern-web-guidance/_book.yaml',
      `description: ${JSON.stringify(cleanDesc)}`,
      'author: Chrome DevRel',
      `refresh_date: ${refreshDate}`,
    ].join('\n');

    const resumedSteps: number[] = [];
    const devsiteResult = toDevsiteMarkdown(processedMarkdown, {
      filePath,
      currentGuideId: id,
      onListMerge: stepNumber => resumedSteps.push(stepNumber),
    });
    if (resumedSteps.length > 0) {
      console.warn(`⚠️  ${path.relative(WORKSPACE_ROOT, filePath)}: folded unindented blocks into ordered lists (resumed at steps ${resumedSteps.join(", ")}).`);
    }

    const headerParts = [
      '<link rel="stylesheet" href="/docs/modern-web-guidance/landing.css">',
    ];
    if (devsiteResult.hasBaselineMacro) {
      headerParts.push('{% import "/_macros.html" as macros %}');
    }
    headerParts.push(`# ${title}`);

    if (featureIds.length > 0) {
      const chipsHtml = [
        '<div class="guidance-chips">',
        '  <span class="guidance-chips-label">Web features:</span>',
      ];
      for (const feat of featureIds) {
        const featEsc = escapeHtml(feat);
        const labelEsc = escapeHtml(getFeatureName(feat));
        chipsHtml.push(`  <a class="guidance-chip" href="https://webstatus.dev/features/${featEsc}">${labelEsc}</a>`);
      }
      chipsHtml.push('</div>');
      headerParts.push(chipsHtml.join('\n'));
    }

    headerParts.push('{% include "/docs/modern-web-guidance/_guide-promo.html" %}');

    const sourceFooter = [
      '<footer class="guidance-source nocontent" data-nosnippet>',
      `  Source: <a href="https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/${category}/${id}/guide.md">${id} guide on GitHub</a>`,
      '</footer>',
    ].join('\n');

    const bodyWithoutH1 = stripLeadingH1(devsiteResult.markdown);
    const finalContent = `${devsiteFrontmatter}\n\n${headerParts.join('\n\n')}\n\n${bodyWithoutH1.trim()}\n\n${sourceFooter}\n`;

    writeBuiltGuide(category, id, finalContent);

    if (devsiteGuides) {
      devsiteGuides.push({
        id,
        title,
        description: cleanDesc,
        category,
        webFeatureIds: featureIds,
        refreshDate,
        path: `guides/${category}/${id}.md`,
      });
    }
    return;
  }

  if (!embedder) {
    throw new Error(`Embedder is required for target ${TARGET}`);
  }
  const featureIds: string[] = data['web-feature-ids'] || [];
  const featuresUsed = featureIds.map(getFeatureName);
  const originTrials = getGuideOriginTrials(featureIds);
  const tokenCount = embedder.countTokens ? await embedder.countTokens(processedMarkdown) : 0;

  useCases.push({
    id,
    description: data.description,
    category,
    featuresUsed,
    tokenCount,
    ...(originTrials.length > 0 ? { originTrials } : {}),
  });

  const h1Title = extractH1Heading(processedMarkdown);
  const title = requireTitle((typeof data.title === 'string' && data.title.trim()) || h1Title, filePath);
  const summaryChunk = `# ${title}\n\n${data.description}`;

  const chunks = IS_NO_CHUNKING
    ? [`${summaryChunk}\n\n${processedMarkdown.trim().replace(/^#\s+[^\n]*\n?/, "")}`]
    : [...chunkMarkdown(processedMarkdown), summaryChunk];

  for (const chunk of chunks) {
    let vector: number[] = [];
    if (modelName) {
      const embeddingText = `${id} (${category})\nFeatures: ${featuresUsed.join(", ")}\n\n${chunk}`;
      vector = await embedder.embed(embeddingText);
    } else {
      const embeddingText = `${id}: ${data.description}\n\n${chunk}`;
      const hash = computeChunkHash(embeddingText);
      const cached = chunkCache?.get(hash);
      if (cached) {
        vector = Array.from(cached);
      } else {
        missingChunks?.push({ guideId: id, category, chunk });
        console.warn(`⚠️ [CACHE MISS] Guide "${id}" chunk lacks cached teacher vector: ${chunk.slice(0, 50).trim()}...`);
        vector = [];
      }
    }

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
    'fail-on-missing-vectors': { type: 'boolean' as const },
  };

  const { values, positionals } = parseArgs({ options, allowPositionals: true });

  const targetGuidePath = positionals[0];
  const force = values.force;
  const noChunking = values['no-chunking'];
  const modelName = values.model;
  const target = (values.target as BuildTarget | undefined) || 'skills-cli';
  const output = values.output;
  const failOnMissingVectors = values['fail-on-missing-vectors'];

  processGuides({
    outputDir: output
      ? path.resolve(WORKSPACE_ROOT, output)
      : (target === 'devsite' ? path.resolve(WORKSPACE_ROOT, 'dist/devsite') : path.join(outDir, "build", target)),
    target,
    force,
    targetGuidePath,
    modelName,
    noChunking,
    failOnMissingVectors,
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
