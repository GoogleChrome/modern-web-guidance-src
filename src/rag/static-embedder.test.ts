import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { StaticEmbedder, STATIC_EMBEDDING_DIMS } from "./static-embedder.ts";
import { tokenize } from "./bm25.ts";

const SCRATCH_CACHE = "/usr/local/google/home/paulirish/.gemini/jetski/brain/72a35306-54fe-4215-ab8a-e40f5a8340fa/scratch/static-cache";

function dotProduct(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

test("StaticEmbedder initializes and produces 256-d unit vectors", () => {
  const embedder = StaticEmbedder.getInstance();
  const vec = embedder.embedSync("autofill address form");
  assert.strictEqual(vec.length, STATIC_EMBEDDING_DIMS);

  let normSq = 0;
  for (let i = 0; i < vec.length; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  assert.ok(Math.abs(norm - 1.0) < 1e-4, `Expected unit norm, got ${norm}`);
});

test("StaticEmbedder handles hyphenated and compound tokens correctly", () => {
  const embedder = StaticEmbedder.getInstance();
  // "user-invalid" might be a known token or split into user + invalid
  const enc = embedder.encode("user-invalid unknownhyphen-form");
  assert.ok(enc.length > 0, "Should encode tokens");
  for (const [, fraction] of enc) {
    assert.ok(fraction > 0 && fraction <= 1, `Invalid fraction ${fraction}`);
  }
});

test("StaticEmbedder returns zero vector for empty or unknown query", () => {
  const embedder = StaticEmbedder.getInstance();
  const vec = embedder.embedSync("$q \\");
  assert.strictEqual(vec.length, STATIC_EMBEDDING_DIMS);
  for (let i = 0; i < vec.length; i++) {
    assert.strictEqual(vec[i], 0);
  }
});

test("StaticEmbedder reproduces reference Float32 embedWith output within int8 tolerance", () => {
  const embedder = StaticEmbedder.getInstance();

  // If the reference training cache is available on disk, compare against direct Float32 reference
  const wordsPath = path.join(SCRATCH_CACHE, "teacher-words-q.json");
  const ePath = path.join(SCRATCH_CACHE, "tokenlearn-E.f32");
  const wPath = path.join(SCRATCH_CACHE, "tokenlearn-W.f32");

  if (!fs.existsSync(wordsPath) || !fs.existsSync(ePath) || !fs.existsSync(wPath)) {
    // If running in an environment without scratch cache, verify self-consistency
    const v1 = embedder.embedSync("autofill address form");
    const v2 = embedder.embedSync("autofill address form");
    assert.deepStrictEqual(v1, v2);
    return;
  }

  const words: string[] = JSON.parse(fs.readFileSync(wordsPath, "utf8"));
  const wordIndex = new Map(words.map((w, i) => [w, i]));
  const E = new Float32Array(fs.readFileSync(ePath).buffer);
  const W = new Float32Array(fs.readFileSync(wPath).buffer);
  const D = STATIC_EMBEDDING_DIMS;

  function referenceEmbed(text: string): Float32Array {
    const out: Array<[number, number]> = [];
    for (const tok of tokenize(text)) {
      const parts = wordIndex.has(tok)
        ? [tok]
        : tok.split("-").filter((p) => wordIndex.has(p));
      for (const p of parts) out.push([wordIndex.get(p)!, 1 / parts.length]);
    }
    const s = new Float32Array(D);
    if (out.length === 0) return s;
    for (const [i, f] of out) {
      const wt = W[i] * f;
      const offset = i * D;
      for (let k = 0; k < D; k++) {
        s[k] += wt * E[offset + k];
      }
    }
    let n = 0;
    for (let k = 0; k < D; k++) n += s[k] * s[k];
    n = Math.sqrt(n) || 1;
    for (let k = 0; k < D; k++) s[k] /= n;
    return s;
  }

  const goldenQueries = [
    "autofill address form",
    "dark mode toggle with css",
    "view transitions api for spa navigation",
    "webgl shader animation effects",
    "passkey authentication without password",
    "accessible dialog modal trap focus",
    "scroll-driven animation progress indicator",
    "container queries size-based responsive layout",
  ];

  for (const query of goldenQueries) {
    const refVec = referenceEmbed(query);
    const staticVec = embedder.embedSync(query);

    const cosine = dotProduct(refVec, staticVec);
    // Int8 quantization with folded scales must match reference within 0.999 cosine similarity
    assert.ok(
      cosine > 0.999,
      `Query "${query}" cosine similarity ${cosine.toFixed(6)} below 0.999 tolerance`
    );

    // Max coordinate difference should be tiny (< 0.015)
    for (let k = 0; k < D; k++) {
      const diff = Math.abs(refVec[k] - staticVec[k]);
      assert.ok(
        diff < 0.015,
        `Query "${query}" dimension ${k} diff ${diff.toFixed(5)} exceeds 0.015`
      );
    }
  }
});
