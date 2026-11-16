import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STATIC_DIMS,
  STATIC_EMBEDDING_DIMS,
  l2Normalize,
  toAlignedFloat32Array,
  toInt8Array,
  dequantizeVectorRow,
  quantizeVectors,
  truncateAndNormalize256,
} from "./quantize.ts";

export {
  STATIC_DIMS,
  STATIC_EMBEDDING_DIMS,
  l2Normalize,
  toAlignedFloat32Array,
  toInt8Array,
  dequantizeVectorRow,
  quantizeVectors,
  truncateAndNormalize256,
};

export const TEACHER_MODEL = "gemini-embedding-001";
export const TASK_TYPE = "RETRIEVAL_DOCUMENT";
export const TEACHER_DIM = 768;

const RAG_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CACHE_DIR = path.join(RAG_DIR, "gen");

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

  const qTable = toInt8Array(i8Buf);
  const scales = toAlignedFloat32Array(scaleBuf);

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
