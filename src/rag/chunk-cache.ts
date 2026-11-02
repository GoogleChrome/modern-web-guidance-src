import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "@11ty/gray-matter";
import { rootDir } from "../core/paths.ts";
import {
  scanAllGuides,
  getGuideMarkdownPath,
  extractH1Heading,
  stripAllComments,
  isDraftStub,
} from "../core/guide-validation.ts";
import { replaceMacros, type BuildTarget } from "../core/macros.ts";
import { getFeatureName } from "../core/baseline.ts";
import { chunkMarkdown } from "../build/build-guides.ts";
import { config } from "../core/skills-config.ts";

export const TEACHER_MODEL = "gemini-embedding-001";
export const TASK_TYPE = "RETRIEVAL_DOCUMENT";
export const TEACHER_DIM = 768;
export const STATIC_DIMS = 256;

export const DEFAULT_CACHE_DIR = path.join(rootDir, "src/rag/static-model");

export interface GuideChunk {
  guideId: string;
  category: string;
  description: string;
  featuresUsed: string[];
  chunkContent: string;
  embeddedText: string;
  hash: string;
}

/**
 * Computes a deterministic sha256 hash identifying the embedded chunk:
 * model + taskType + dims + embedded text.
 * Any change to macros, feature names, chunker, or guide prose changes this hash.
 */
export function computeChunkHash(
  embeddedText: string,
  model = TEACHER_MODEL,
  taskType = TASK_TYPE,
  dims = STATIC_DIMS
): string {
  return crypto
    .createHash("sha256")
    .update(`${model}\n${taskType}\n${dims}\n${embeddedText}`)
    .digest("hex");
}

/**
 * Normalizes an array-like vector to unit L2 norm.
 */
export function l2Normalize(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/**
 * Truncates a 768-d vector to 256-d (MRL) and L2-normalizes it.
 */
export function truncateAndNormalize256(v768: ArrayLike<number>): Float32Array {
  const t = new Float32Array(STATIC_DIMS);
  for (let i = 0; i < STATIC_DIMS; i++) t[i] = v768[i];
  return l2Normalize(t);
}

/**
 * Loads the committed Int8 chunk vector cache from disk.
 * Returns a map of hash -> 256-d unit Float32Array.
 */
export function loadChunkCache(cacheDir = DEFAULT_CACHE_DIR): Map<string, Float32Array> {
  const jsonPath = path.join(cacheDir, "chunks.json");
  const i8Path = path.join(cacheDir, "chunks.i8");
  const scalePath = path.join(cacheDir, "chunks.scale.f32");

  if (!fs.existsSync(jsonPath) || !fs.existsSync(i8Path) || !fs.existsSync(scalePath)) {
    return new Map();
  }

  const hashes: string[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const i8Buf = fs.readFileSync(i8Path);
  const scaleBuf = fs.readFileSync(scalePath);

  const N = hashes.length;
  if (i8Buf.byteLength !== N * STATIC_DIMS) {
    throw new Error(
      `Chunk cache corrupted: ${i8Path} byteLength (${i8Buf.byteLength}) !== ${N} * ${STATIC_DIMS}`
    );
  }
  if (scaleBuf.byteLength !== N * 4) {
    throw new Error(
      `Chunk cache corrupted: ${scalePath} byteLength (${scaleBuf.byteLength}) !== ${N} * 4`
    );
  }

  const qTable = new Int8Array(i8Buf.buffer, i8Buf.byteOffset, i8Buf.byteLength);
  const scales = new Float32Array(scaleBuf.buffer, scaleBuf.byteOffset, N);

  const cache = new Map<string, Float32Array>();
  for (let i = 0; i < N; i++) {
    const scale = scales[i];
    const offset = i * STATIC_DIMS;
    const vec = new Float32Array(STATIC_DIMS);
    for (let k = 0; k < STATIC_DIMS; k++) {
      vec[k] = qTable[offset + k] * scale;
    }
    cache.set(hashes[i], l2Normalize(vec));
  }

  return cache;
}

/**
 * Quantizes and saves the chunk cache into chunks.json, chunks.i8, and chunks.scale.f32.
 * Entries are sorted by hash for deterministic output.
 * Any entry not present in `cache` is omitted (pruned).
 */
export function saveChunkCache(
  cache: Map<string, Float32Array>,
  cacheDir = DEFAULT_CACHE_DIR
): { count: number; bytes: number } {
  fs.mkdirSync(cacheDir, { recursive: true });

  const sortedHashes = [...cache.keys()].sort();
  const N = sortedHashes.length;

  const qTable = new Int8Array(N * STATIC_DIMS);
  const scales = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const hash = sortedHashes[i];
    const vec = cache.get(hash);
    if (!vec || vec.length !== STATIC_DIMS) {
      throw new Error(`Invalid vector for hash ${hash} in saveChunkCache`);
    }

    let maxAbs = 0;
    for (let k = 0; k < STATIC_DIMS; k++) {
      const abs = Math.abs(vec[k]);
      if (abs > maxAbs) maxAbs = abs;
    }

    const scale = maxAbs > 0 ? maxAbs / 127 : 1;
    scales[i] = scale;

    const offset = i * STATIC_DIMS;
    for (let k = 0; k < STATIC_DIMS; k++) {
      const q = Math.round(vec[k] / scale);
      qTable[offset + k] = Math.max(-127, Math.min(127, q));
    }
  }

  const jsonPath = path.join(cacheDir, "chunks.json");
  const i8Path = path.join(cacheDir, "chunks.i8");
  const scalePath = path.join(cacheDir, "chunks.scale.f32");

  fs.writeFileSync(jsonPath, JSON.stringify(sortedHashes) + "\n");
  fs.writeFileSync(i8Path, Buffer.from(qTable.buffer, qTable.byteOffset, qTable.byteLength));
  fs.writeFileSync(scalePath, Buffer.from(scales.buffer, scales.byteOffset, scales.byteLength));

  const totalBytes =
    Buffer.byteLength(JSON.stringify(sortedHashes)) + qTable.byteLength + scales.byteLength;
  return { count: N, bytes: totalBytes };
}

/**
 * Scans all published guides in the corpus and generates the exact list of
 * chunks that need teacher embedding vectors.
 */
export function scanCorpusChunks(target: BuildTarget = "skills-cli"): GuideChunk[] {
  const readyGuides = scanAllGuides().filter((inv) => {
    const excluded = config.monoskill.excludeFromBundling || [];
    return inv.isPublished && !excluded.includes(inv.category) && !excluded.includes(inv.name);
  });

  const allChunks: GuideChunk[] = [];

  for (const inv of readyGuides) {
    const guidePath = getGuideMarkdownPath(inv);
    const content = fs.readFileSync(guidePath, "utf-8");
    const { data, content: markdownBody, matter: frontmatter } = matter(content, {});

    if (stripAllComments(markdownBody).trim().length === 0 || isDraftStub(data.draft)) {
      continue;
    }
    if (!data.description || !frontmatter) {
      throw new Error(`Missing frontmatter or description in ${guidePath}`);
    }

    const processedMarkdown = replaceMacros(markdownBody, guidePath, { target });
    const featureIds: string[] = data["web-feature-ids"] || [];
    const featuresUsed = featureIds.map(getFeatureName);

    const h1Title = extractH1Heading(processedMarkdown);
    const title = (h1Title || data.title || "").trim();
    if (!title) {
      throw new Error(`Guide has no H1 heading or frontmatter title: ${guidePath}`);
    }

    const summaryChunk = `# ${title}\n\n${data.description}`;
    const chunks = [...chunkMarkdown(processedMarkdown), summaryChunk];

    for (const chunk of chunks) {
      const embeddedText = `${inv.name}: ${data.description}\n\n${chunk}`;
      const hash = computeChunkHash(embeddedText);
      allChunks.push({
        guideId: inv.name,
        category: inv.category,
        description: data.description,
        featuresUsed,
        chunkContent: chunk,
        embeddedText,
        hash,
      });
    }
  }

  return allChunks;
}
