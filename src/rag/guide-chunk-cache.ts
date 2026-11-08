import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { rootDir } from "../core/paths.ts";

export const TEACHER_MODEL = "gemini-embedding-001";
export const TASK_TYPE = "RETRIEVAL_DOCUMENT";
export const TEACHER_DIM = 768;
export const STATIC_DIMS = 256;

export const DEFAULT_CACHE_DIR = path.join(rootDir, "src/rag/gen");

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
 * Quantizes an array of vector rows (`number[] | Float32Array`, or empty for uncached chunks)
 * into a flat `Int8Array(N * dims)` and `Float32Array(N)` scales (`0` for empty vectors).
 */
export function quantizeVectors(
  vectors: ReadonlyArray<ArrayLike<number>>,
  dims = STATIC_DIMS
): { qTable: Int8Array; scales: Float32Array } {
  const N = vectors.length;
  const qTable = new Int8Array(N * dims);
  const scales = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const vec = vectors[i];
    if (!vec || vec.length === 0) {
      scales[i] = 0;
      continue;
    }
    if (vec.length !== dims) {
      throw new Error(`Invalid vector dimension at index ${i}: expected ${dims}, got ${vec.length}`);
    }

    let maxAbs = 0;
    for (let k = 0; k < dims; k++) {
      const abs = Math.abs(vec[k]);
      if (abs > maxAbs) maxAbs = abs;
    }

    const scale = maxAbs > 0 ? maxAbs / 127 : 0;
    scales[i] = scale;
    if (scale === 0) continue;

    const offset = i * dims;
    for (let k = 0; k < dims; k++) {
      const q = Math.round(vec[k] / scale);
      qTable[offset + k] = Math.max(-127, Math.min(127, q));
    }
  }

  return { qTable, scales };
}

/**
 * Dequantizes a single row from `(qTable, scales)` at index `i` and L2-normalizes it.
 * Returns an empty `Float32Array(0)` when `scales[i] === 0` (uncached BM25-only chunk).
 */
export function dequantizeVectorRow(
  qTable: Int8Array,
  scales: Float32Array,
  index: number,
  dims = STATIC_DIMS
): Float32Array {
  const scale = scales[index];
  if (!scale) {
    return new Float32Array(0);
  }
  const offset = index * dims;
  const vec = new Float32Array(dims);
  for (let k = 0; k < dims; k++) {
    vec[k] = qTable[offset + k] * scale;
  }
  return l2Normalize(vec);
}

/**
 * Loads the committed Int8 chunk vector cache from disk.
 * Returns a map of hash -> 256-d unit Float32Array.
 */
export function loadChunkCache(cacheDir = DEFAULT_CACHE_DIR): Map<string, Float32Array> {
  const jsonPath = path.join(cacheDir, "guide-chunk-cache.json");
  const i8Path = path.join(cacheDir, "guide-chunk-cache.i8");
  const scalePath = path.join(cacheDir, "guide-chunk-cache.scale.f32");

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
  // Slice to a fresh ArrayBuffer so Float32Array is guaranteed 4-byte aligned regardless of Buffer slab pooling.
  const alignedScaleBuf = scaleBuf.buffer.slice(
    scaleBuf.byteOffset,
    scaleBuf.byteOffset + scaleBuf.byteLength
  );
  const scales = new Float32Array(alignedScaleBuf);

  const cache = new Map<string, Float32Array>();
  for (let i = 0; i < N; i++) {
    cache.set(hashes[i], dequantizeVectorRow(qTable, scales, i, STATIC_DIMS));
  }

  return cache;
}

/**
 * Quantizes and saves the chunk cache into guide-chunk-cache.json, guide-chunk-cache.i8, and guide-chunk-cache.scale.f32.
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
  const vectors: Float32Array[] = [];

  for (let i = 0; i < N; i++) {
    const hash = sortedHashes[i];
    const vec = cache.get(hash);
    if (!vec || vec.length !== STATIC_DIMS) {
      throw new Error(`Invalid vector for hash ${hash} in saveChunkCache`);
    }
    vectors.push(vec);
  }

  const { qTable, scales } = quantizeVectors(vectors, STATIC_DIMS);

  const jsonPath = path.join(cacheDir, "guide-chunk-cache.json");
  const i8Path = path.join(cacheDir, "guide-chunk-cache.i8");
  const scalePath = path.join(cacheDir, "guide-chunk-cache.scale.f32");

  const jsonContent = JSON.stringify(sortedHashes, null, 2) + "\n";
  fs.writeFileSync(jsonPath, jsonContent);
  fs.writeFileSync(i8Path, Buffer.from(qTable.buffer, qTable.byteOffset, qTable.byteLength));
  fs.writeFileSync(scalePath, Buffer.from(scales.buffer, scales.byteOffset, scales.byteLength));

  const totalBytes =
    Buffer.byteLength(jsonContent) + qTable.byteLength + scales.byteLength;
  return { count: N, bytes: totalBytes };
}
