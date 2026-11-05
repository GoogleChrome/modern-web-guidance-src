import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "./bm25.ts";
import type { EmbedderLike } from "./search.ts";

export const STATIC_EMBEDDING_DIMS = 256;

interface StaticModelData {
  words: string[];
  wordIndex: Map<string, number>;
  table: Int8Array;
  scales: Float32Array;
}

/**
 * Encodes text into `[(wordIndex, fraction)]` weights using BM25 tokenization with hyphen fallback.
 * Unknown hyphenated tokens split on `"-"` into known parts, each weighted `1 / matched.length`.
 */
export function encodeTokens(
  text: string,
  wordIndex: ReadonlyMap<string, number>
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const tok of tokenize(text)) {
    const directIdx = wordIndex.get(tok);
    if (directIdx !== undefined) {
      out.push([directIdx, 1]);
      continue;
    }
    if (tok.includes("-")) {
      const matched: number[] = [];
      for (const part of tok.split("-")) {
        const idx = wordIndex.get(part);
        if (idx !== undefined) matched.push(idx);
      }
      if (matched.length > 0) {
        const weight = 1 / matched.length;
        for (const idx of matched) {
          out.push([idx, weight]);
        }
      }
    }
  }
  return out;
}

/**
 * Accumulates the weighted sum of `table` rows for `enc` and L2-normalizes in-place.
 */
export function accumulateNormalizedVector(
  enc: ReadonlyArray<[number, number]>,
  table: Int8Array | Float32Array,
  scales: Float32Array,
  out = new Float32Array(STATIC_EMBEDDING_DIMS)
): Float32Array {
  out.fill(0);
  if (enc.length === 0) {
    return out;
  }
  for (const [i, f] of enc) {
    const wt = scales[i] * f;
    const offset = i * STATIC_EMBEDDING_DIMS;
    for (let k = 0; k < STATIC_EMBEDDING_DIMS; k++) {
      out[k] += wt * table[offset + k];
    }
  }
  let normSq = 0;
  for (let k = 0; k < STATIC_EMBEDDING_DIMS; k++) {
    normSq += out[k] * out[k];
  }
  const norm = Math.sqrt(normSq) || 1;
  for (let k = 0; k < STATIC_EMBEDDING_DIMS; k++) {
    out[k] /= norm;
  }
  return out;
}

export class StaticEmbedder implements EmbedderLike {
  private static instance: StaticEmbedder | null = null;
  private model: StaticModelData | null = null;

  private constructor() {}

  public static getInstance(): StaticEmbedder {
    if (!StaticEmbedder.instance) {
      StaticEmbedder.instance = new StaticEmbedder();
    }
    return StaticEmbedder.instance;
  }

  public init(): void {
    this.ensureModel();
  }

  private ensureModel(): StaticModelData {
    if (this.model) return this.model;

    const modelDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "static-model");
    const wordsPath = path.join(modelDir, "words.json");
    const tablePath = path.join(modelDir, "words.i8");
    const scalesPath = path.join(modelDir, "words.scale.f32");

    if (!fs.existsSync(wordsPath) || !fs.existsSync(tablePath) || !fs.existsSync(scalesPath)) {
      throw new Error(`Static model files missing in ${modelDir}. Expected words.json, words.i8, words.scale.f32`);
    }

    const rawWords: unknown = JSON.parse(fs.readFileSync(wordsPath, "utf8"));
    if (!Array.isArray(rawWords)) {
      throw new Error(`Corrupt words.json in ${modelDir}: expected JSON array`);
    }
    const words = rawWords.map(String);
    const wordIndex = new Map<string, number>();
    for (let i = 0; i < words.length; i++) {
      wordIndex.set(words[i], i);
    }

    const tableBuf = fs.readFileSync(tablePath);
    if (tableBuf.byteLength !== words.length * STATIC_EMBEDDING_DIMS) {
      throw new Error(
        `Corrupt words.i8: size ${tableBuf.byteLength} != expected ${words.length * STATIC_EMBEDDING_DIMS}`
      );
    }
    const table = new Int8Array(tableBuf.buffer, tableBuf.byteOffset, tableBuf.byteLength);

    const scaleBuf = fs.readFileSync(scalesPath);
    if (scaleBuf.byteLength !== words.length * 4) {
      throw new Error(
        `Corrupt words.scale.f32: size ${scaleBuf.byteLength} != expected ${words.length * 4}`
      );
    }
    // Slice to a fresh ArrayBuffer so Float32Array is guaranteed 4-byte aligned regardless of Buffer slab pooling.
    const alignedScaleBuf = scaleBuf.buffer.slice(scaleBuf.byteOffset, scaleBuf.byteOffset + scaleBuf.byteLength);
    const scales = new Float32Array(alignedScaleBuf);

    this.model = { words, wordIndex, table, scales };
    return this.model;
  }

  public encode(text: string): Array<[number, number]> {
    const model = this.ensureModel();
    return encodeTokens(text, model.wordIndex);
  }

  public async embed(text: string): Promise<number[]> {
    return this.embedSync(text);
  }

  public embedSync(text: string): number[] {
    const model = this.ensureModel();
    const enc = encodeTokens(text, model.wordIndex);
    return Array.from(accumulateNormalizedVector(enc, model.table, model.scales));
  }

  public countTokens(text: string): number {
    return (text.match(/\w+|[^\w\s]/g) ?? []).length;
  }
}
