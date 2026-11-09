import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parseArgs } from "node:util";
import { type BuildTarget } from "../core/macros.ts";
import { gitExec } from "../core/git-utils.ts";
import {
  scanAllGuides,
  type GuideInventory,
  getGuideMarkdownPath,
  stripLeadingH1,
} from "../core/guide-validation.ts";
import {
  getGuideOriginTrials,
  getGuideVolatileFeatures,
} from "../core/feature-gates.ts";
import { isTmpFeature } from "../core/feature-parser.ts";
import { config } from "../core/skills-config.ts";
import { getFeatureName } from "../core/baseline.ts";
import { rootDir, outDir } from "../core/paths.ts";
import { CATEGORIES } from "../core/categories.ts";
import { toDevsiteMarkdown } from "./devsite-markdown.ts";
import type { UseCase } from "../rag/guides.ts";
import type { EmbedderLike } from "../rag/search.ts";
import { loadChunkCache, quantizeVectors, STATIC_DIMS } from "../rag/guide-chunk-cache.ts";
import {
  parseGuideFile,
  extractGuideChunks,
} from "../core/guide-chunks.ts";

const WORKSPACE_ROOT = rootDir;

export interface StoreUseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  tokenCount?: number;
  chunkContent?: string;
  vector?: number[];
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

export interface BuildOptions {
  outputDir: string;
  target?: BuildTarget;
  force?: boolean;
  targetGuidePath?: string;
  modelName?: string;
  noChunking?: boolean;
  failOnMissingVectors?: boolean;
}

interface CachePaths {
  cacheDir: string;
  cachedGenDir: string;
  cachedVectors: string;
  cachedVectorsI8: string;
  cachedVectorsScale: string;
  cachedGuidesJson: string;
  cachedManifest: string;
  cachedGuides: string;
}

function resolveCachePaths(target: BuildTarget): CachePaths {
  const cacheDir = path.join(outDir, 'build', target);
  const cachedGenDir = path.join(cacheDir, 'gen');
  return {
    cacheDir,
    cachedGenDir,
    cachedVectors: path.join(cachedGenDir, "guide-chunks.json.gz"),
    cachedVectorsI8: path.join(cachedGenDir, "guide-chunks.i8"),
    cachedVectorsScale: path.join(cachedGenDir, "guide-chunks.scale.f32"),
    cachedGuidesJson: path.join(cachedGenDir, "guides.json"),
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
    path.join(rootDir, "src/rag/guide-chunk-cache.ts"),
    path.join(rootDir, "src/rag/quantize.ts"),
    path.join(rootDir, "src/core/guide-chunks.ts"),
    path.join(rootDir, "src/rag/gen/guide-chunk-cache.json"),
    path.join(rootDir, "src/rag/gen/guide-chunk-cache.i8"),
    path.join(rootDir, "src/rag/gen/guide-chunk-cache.scale.f32"),
    path.join(rootDir, "src/core/guide-validation.ts"),
    path.join(rootDir, "src/core/feature-gates.ts"),
    path.join(rootDir, "features/origin-trials.json"),
    path.join(rootDir, "features/volatile-features.json"),
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
    const cacheFiles = [
      paths.cachedGuidesJson,
      paths.cachedVectors,
      paths.cachedVectorsI8,
      paths.cachedVectorsScale,
      paths.cachedGuides,
    ];
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
    const destGenDir = path.join(outputDir, "gen");
    fs.mkdirSync(destGenDir, { recursive: true });
    fs.copyFileSync(paths.cachedVectors, path.join(destGenDir, "guide-chunks.json.gz"));
    fs.copyFileSync(paths.cachedVectorsI8, path.join(destGenDir, "guide-chunks.i8"));
    fs.copyFileSync(paths.cachedVectorsScale, path.join(destGenDir, "guide-chunks.scale.f32"));
    fs.copyFileSync(paths.cachedGuidesJson, path.join(destGenDir, "guides.json"));
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
  fs.mkdirSync(paths.cachedGenDir, { recursive: true });
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
    sourceCommit = gitExec(["rev-parse", "HEAD"], { cwd: WORKSPACE_ROOT }).trim();
    const raw = gitExec(["log", "--format=COMMIT %cs", "--name-only", "HEAD", "--", "guides/", "features/"], {
      cwd: WORKSPACE_ROOT,
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
  const { outputDir, target: targetOpt, force, targetGuidePath, modelName, noChunking, failOnMissingVectors } = opts;

  const target = targetOpt || 'skills-cli';
  const isNoChunking = !!noChunking;

  // 1. Configuration & Paths
  const cachePaths = resolveCachePaths(target);
  const buildGuidesDir = cachePaths.cachedGuides;

  // 2. Scan & Hash
  let readyGuides = scanAllGuides().filter(inv => {
    const excluded = config.monoskill.excludeFromBundling || [];
    return inv.isPublished && !excluded.includes(inv.category) && !excluded.includes(inv.name);
  });
  const currentHash = await computePipelineHash(
    readyGuides,
    target,
    isNoChunking,
    modelName,
    failOnMissingVectors
  );

  // 3. Cache Evaluation
  const isHit = !force && !targetGuidePath && evaluateCacheHit(cachePaths, currentHash, readyGuides, target);
  if (isHit) {
    restoreFromCache(cachePaths, outputDir, target);
    console.log("👌");
    return true; // Skipped
  }

  // 4. Execution Pipeline (Miss)
  prepareCleanCacheDir(cachePaths);

  const useCases: UseCase[] = [];
  const storeUseCases: StoreUseCase[] = [];
  const devsiteGuides: DevsiteGuideMetadata[] = [];
  const gitInfo = target === 'devsite' ? loadGitFileDates() : { fileDates: new Map(), sourceCommit: "unknown" };

  let embedder: EmbedderLike | undefined;
  if (target !== 'devsite' && modelName) {
    console.log(`Using custom embedding model: ${modelName}`);
    const { Embedder } = await import("../rag/transformers-embedder.ts");
    const inst = Embedder.getInstance(modelName);
    await inst.init();
    embedder = inst;
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

  const chunkCache = target !== 'devsite' && !modelName ? loadChunkCache() : null;
  const missingChunks: Array<{ guideId: string; category: string; chunk: string }> = [];

  console.log(target === 'devsite' ? "Exporting DevSite guides…" : "Generating embeddings…");
  for (const inv of readyGuides) {
    const guidePath = getGuideMarkdownPath(inv);
    if (target === 'devsite') {
      await processDevsiteGuide({
        filePath: guidePath,
        category: inv.category,
        id: inv.name,
        buildGuidesDir,
        devsiteGuides,
        gitInfo,
      });
    } else {
      await processSkillsCliGuide({
        filePath: guidePath,
        category: inv.category,
        id: inv.name,
        useCases,
        storeUseCases,
        noChunking: isNoChunking,
        buildGuidesDir,
        embedder,
        modelName,
        chunkCache,
        missingChunks,
      });
    }
  }

  if (missingChunks.length > 0) {
    const missingGuides = [...new Set(missingChunks.map((m) => m.guideId))];
    if (failOnMissingVectors) {
      console.warn(
        `\n⚠️  WARNING: ${missingChunks.length} chunk(s) across ${missingGuides.length} guide(s) lack cached teacher vectors:`
      );
      for (const g of missingGuides) {
        console.warn(`   - ${g}`);
      }
      console.warn(
        `   These chunks are indexed for BM25 only (vector: []). Run 'node src/rag/embed-guide-chunks.ts' to embed them with the teacher model.\n`
      );
      throw new Error(
        `Release check failed: ${missingChunks.length} chunk(s) across ${missingGuides.length} guide(s) lack cached teacher vectors. Run 'node src/rag/embed-guide-chunks.ts' before release.`
      );
    } else {
      console.log(`ℹ️  ${missingChunks.length} chunk(s) across ${missingGuides.length} guide(s) not yet in guide-chunk-cache (using BM25 until release embedding).`);
    }
  }

  if (target === 'skills-cli') {
    fs.writeFileSync(cachePaths.cachedGuidesJson, JSON.stringify(useCases, null, 2) + '\n');
    console.log(`Generated ${useCases.length} use cases to ${path.relative(WORKSPACE_ROOT, cachePaths.cachedGuidesJson)}`);

    const firstVec = storeUseCases.find((u) => u.vector && u.vector.length > 0)?.vector;
    const dims = firstVec ? firstVec.length : STATIC_DIMS;
    const { qTable, scales } = quantizeVectors(
      storeUseCases.map((u) => u.vector ?? []),
      dims
    );
    const metadataOnly = storeUseCases.map(({ vector: _vector, ...rest }) => rest);
    const jsonContent = JSON.stringify(metadataOnly);
    const compressed = zlib.gzipSync(jsonContent);
    fs.writeFileSync(cachePaths.cachedVectors, compressed);
    fs.writeFileSync(
      cachePaths.cachedVectorsI8,
      Buffer.from(qTable.buffer, qTable.byteOffset, qTable.byteLength)
    );
    fs.writeFileSync(
      cachePaths.cachedVectorsScale,
      Buffer.from(scales.buffer, scales.byteOffset, scales.byteLength)
    );
  } else if (target === 'devsite') {
    const latestGuideDate = devsiteGuides.reduce(
      (max, g) => (g.refreshDate > max ? g.refreshDate : max),
      '2026-01-01'
    );

    const indexContent = generateGuidesIndex(devsiteGuides, latestGuideDate);
    fs.writeFileSync(path.join(buildGuidesDir, 'index.md'), indexContent);

    const tocContent = generateGuidesTocYaml(devsiteGuides);
    fs.writeFileSync(path.join(buildGuidesDir, '_toc.yaml'), tocContent);

    const manifestPath = path.join(cachePaths.cacheDir, 'manifest.json');
    const manifest = {
      generatedAt: new Date().toISOString(),
      sourceCommit: gitInfo.sourceCommit,
      guides: devsiteGuides,
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Generated DevSite target with ${devsiteGuides.length} guides`);
  }

  fs.writeFileSync(
    path.join(cachePaths.cacheDir, "pipeline.manifest.json"),
    JSON.stringify({ hash: currentHash }, null, 2) + '\n'
  );

  restoreFromCache(cachePaths, outputDir, target);
  return false;
}

function writeBuiltGuide(
  buildGuidesDir: string | undefined,
  category: string,
  id: string,
  content: string
): string | undefined {
  if (!buildGuidesDir) return undefined;
  const buildCategoryDir = path.join(buildGuidesDir, category);
  fs.mkdirSync(buildCategoryDir, { recursive: true });
  const buildFilePath = path.join(buildCategoryDir, `${id}.md`);
  fs.writeFileSync(buildFilePath, content);
  return buildFilePath;
}

function approxTokens(text: string): number {
  return (text.match(/\w+|[^\w\s]/g) || []).length;
}

export interface ProcessDevsiteGuideOptions {
  filePath: string;
  category: string;
  id: string;
  buildGuidesDir?: string;
  devsiteGuides?: DevsiteGuideMetadata[];
  gitInfo?: GitInfo;
}

export async function processDevsiteGuide(
  options: ProcessDevsiteGuideOptions
): Promise<void> {
  const { filePath, category, id, buildGuidesDir, devsiteGuides, gitInfo } = options;
  const includedFiles = new Set<string>();
  const parsed = parseGuideFile({ filePath, target: 'devsite', includedFiles });
  if (!parsed) {
    // Just a stub guide. No content to index.
    return;
  }

  const { title, description, featureIds: rawFeatureIds, processedMarkdown } = parsed;
  const featureIds = rawFeatureIds.filter((fid: string) => !isTmpFeature(fid));

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

  const cleanDesc = String(description || "").replace(/\r\n/g, " ").replace(/\n/g, " ").trim();

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
    onListMerge: (stepNumber) => resumedSteps.push(stepNumber),
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

  writeBuiltGuide(buildGuidesDir, category, id, finalContent);

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
}

export interface ProcessSkillsCliGuideOptions {
  filePath: string;
  category: string;
  id: string;
  useCases: UseCase[];
  storeUseCases: StoreUseCase[];
  noChunking?: boolean;
  buildGuidesDir?: string;
  embedder?: EmbedderLike;
  modelName?: string;
  chunkCache?: Map<string, Float32Array> | null;
  missingChunks?: Array<{ guideId: string; category: string; chunk: string }>;
}

export async function processSkillsCliGuide(
  options: ProcessSkillsCliGuideOptions
): Promise<void> {
  const {
    filePath,
    category,
    id,
    useCases,
    storeUseCases,
    noChunking = false,
    buildGuidesDir,
    embedder,
    modelName,
    chunkCache,
    missingChunks,
  } = options;

  const extracted = extractGuideChunks({
    filePath,
    category,
    id,
    target: 'skills-cli',
    noChunking,
  });
  if (!extracted) {
    return;
  }

  if (modelName && !embedder) {
    throw new Error(`Embedder is required when modelName "${modelName}" is provided for skills-cli target`);
  }
  const { description, featureIds, featuresUsed, processedMarkdown } = extracted;
  const originTrials = getGuideOriginTrials(featureIds);
  const volatileFeatures = getGuideVolatileFeatures(featureIds);
  const tokenCount = embedder?.countTokens
    ? await embedder.countTokens(processedMarkdown)
    : approxTokens(processedMarkdown);

  useCases.push({
    id,
    description,
    category,
    featuresUsed,
    tokenCount,
    ...(originTrials.length > 0 ? { originTrials } : {}),
    ...(volatileFeatures.length > 0 ? { volatileFeatures } : {}),
  });

  for (const ec of extracted.embeddedChunks) {
    let vector: number[] = [];
    if (modelName && embedder) {
      vector = await embedder.embed(ec.embeddedText);
    } else {
      const cached = chunkCache?.get(ec.hash);
      if (cached) {
        vector = Array.from(cached);
      } else {
        missingChunks?.push({ guideId: id, category, chunk: ec.chunk });
        vector = [];
      }
    }

    storeUseCases.push({
      id,
      description,
      category,
      featuresUsed,
      tokenCount,
      chunkContent: ec.embeddedText,
      vector,
    });
  }

  writeBuiltGuide(buildGuidesDir, category, id, processedMarkdown.trimStart());
}

export interface ProcessSingleGuideFileOptions extends Partial<ProcessDevsiteGuideOptions>, Partial<ProcessSkillsCliGuideOptions> {
  filePath: string;
  category: string;
  id: string;
  target?: BuildTarget;
}

export async function processSingleGuideFile(
  options: ProcessSingleGuideFileOptions
): Promise<void> {
  if (options.target === 'devsite') {
    return processDevsiteGuide({
      filePath: options.filePath,
      category: options.category,
      id: options.id,
      buildGuidesDir: options.buildGuidesDir,
      devsiteGuides: options.devsiteGuides,
      gitInfo: options.gitInfo,
    });
  }
  return processSkillsCliGuide({
    filePath: options.filePath,
    category: options.category,
    id: options.id,
    useCases: options.useCases || [],
    storeUseCases: options.storeUseCases || [],
    noChunking: options.noChunking,
    buildGuidesDir: options.buildGuidesDir,
    embedder: options.embedder,
    modelName: options.modelName,
    chunkCache: options.chunkCache,
    missingChunks: options.missingChunks,
  });
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
