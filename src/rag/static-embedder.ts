import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "./bm25.ts";
import type { EmbedderLike } from "./search.ts";

export const STATIC_EMBEDDING_DIMS = 256;

export class StaticEmbedder implements EmbedderLike {
  private static instance: StaticEmbedder | null = null;
  private words: string[] = [];
  private wordIndex = new Map<string, number>();
  private table!: Int8Array;
  private scales!: Float32Array;
  private initialized = false;

  private constructor() {}

  public static getInstance(): StaticEmbedder {
    if (!StaticEmbedder.instance) {
      StaticEmbedder.instance = new StaticEmbedder();
    }
    return StaticEmbedder.instance;
  }

  public init(): void {
    if (this.initialized) return;
    const modelDir = this.resolveModelDir();
    const wordsPath = path.join(modelDir, "words.json");
    const tablePath = path.join(modelDir, "words.i8");
    const scalesPath = path.join(modelDir, "words.scale.f32");

    if (!fs.existsSync(wordsPath) || !fs.existsSync(tablePath) || !fs.existsSync(scalesPath)) {
      throw new Error(`Static model files missing in ${modelDir}. Expected words.json, words.i8, words.scale.f32`);
    }

    this.words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));
    this.wordIndex.clear();
    for (let i = 0; i < this.words.length; i++) {
      this.wordIndex.set(this.words[i], i);
    }

    const tableBuf = fs.readFileSync(tablePath);
    if (tableBuf.byteLength !== this.words.length * STATIC_EMBEDDING_DIMS) {
      throw new Error(
        `Corrupt words.i8: size ${tableBuf.byteLength} != expected ${this.words.length * STATIC_EMBEDDING_DIMS}`
      );
    }
    this.table = new Int8Array(tableBuf.buffer, tableBuf.byteOffset, tableBuf.byteLength);

    const scaleBuf = fs.readFileSync(scalesPath);
    if (scaleBuf.byteLength !== this.words.length * 4) {
      throw new Error(
        `Corrupt words.scale.f32: size ${scaleBuf.byteLength} != expected ${this.words.length * 4}`
      );
    }
    this.scales = new Float32Array(scaleBuf.buffer, scaleBuf.byteOffset, scaleBuf.byteLength / 4);

    this.initialized = true;
  }

  private resolveModelDir(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));

    // 1. In bundle or adjacent directory
    const adjacent = path.join(currentDir, "static-model");
    if (fs.existsSync(path.join(adjacent, "words.json"))) {
      return adjacent;
    }

    // 2. Walk up to repo / package root
    let dir = currentDir;
    while (dir !== path.dirname(dir)) {
      const candidateSrc = path.join(dir, "src/rag/static-model");
      if (fs.existsSync(path.join(candidateSrc, "words.json"))) {
        return candidateSrc;
      }
      const candidateDist = path.join(dir, "dist/skills-cli/skills/modern-web-guidance/static-model");
      if (fs.existsSync(path.join(candidateDist, "words.json"))) {
        return candidateDist;
      }
      const candidateOut = path.join(dir, "out/build/skills-cli/static-model");
      if (fs.existsSync(path.join(candidateOut, "words.json"))) {
        return candidateOut;
      }
      dir = path.dirname(dir);
    }

    return adjacent;
  }

  /**
   * Text → [(wordIndex, partFraction)] using BM25 tokenize with hyphen fallback.
   * Unknown hyphenated tokens split on '-' into known parts, each part weighted 1/parts.length.
   */
  public encode(text: string): Array<[number, number]> {
    this.init();
    const out: Array<[number, number]> = [];
    for (const tok of tokenize(text)) {
      const parts = this.wordIndex.has(tok)
        ? [tok]
        : tok.split("-").filter((p) => this.wordIndex.has(p));
      for (const p of parts) {
        out.push([this.wordIndex.get(p)!, 1 / parts.length]);
      }
    }
    return out;
  }

  public async embed(text: string): Promise<number[]> {
    return this.embedSync(text);
  }

  public embedSync(text: string): number[] {
    this.init();
    const enc = this.encode(text);
    const s = new Float32Array(STATIC_EMBEDDING_DIMS);
    if (enc.length === 0) {
      return Array.from(s);
    }
    for (const [i, f] of enc) {
      const wt = this.scales[i] * f;
      const offset = i * STATIC_EMBEDDING_DIMS;
      for (let k = 0; k < STATIC_EMBEDDING_DIMS; k++) {
        s[k] += wt * this.table[offset + k];
      }
    }
    let n = 0;
    for (let k = 0; k < STATIC_EMBEDDING_DIMS; k++) {
      n += s[k] * s[k];
    }
    n = Math.sqrt(n) || 1;
    for (let k = 0; k < STATIC_EMBEDDING_DIMS; k++) {
      s[k] /= n;
    }
    return Array.from(s);
  }

  public countTokens(text: string): number {
    return (text.match(/\w+|[^\w\s]/g) ?? []).length;
  }
}
