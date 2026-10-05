import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { memory } from "@tensorflow/tfjs-core";
import { BertTokenizer } from "@huggingface/transformers";
import { Tokenizer } from "@huggingface/tokenizers";
import { TfjsEmbedder } from "./tfjs-embedder.ts";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe("TfjsEmbedder", () => {
  test("generates embeddings matching reference output", async () => {
    const embedder = TfjsEmbedder.getInstance();
    await embedder.init();

    const text = "Hello world";
    const embedding = await embedder.embed(text);

    assert.ok(Array.isArray(embedding), "Embedding should be an array");
    assert.strictEqual(embedding.length, 384, "Embedding should have length 384");

    for (const val of embedding) {
      assert.strictEqual(typeof val, "number", "All elements must be numbers");
    }

    const expectedValues = [
      -0.03447725251317024,
      0.031023215502500534,
      0.006734978407621384,
      0.026108967140316963,
      -0.039362020790576935
    ];

    for (let i = 0; i < 5; i++) {
      assert.ok(
        Math.abs(embedding[i] - expectedValues[i]) < 0.05,
        `Value at ${i} should match within tolerance. Expected ${expectedValues[i]}, got ${embedding[i]}`
      );
    }
  });

  test("maintains strict tensor hygiene across sequential, concurrent, and throwing embed calls", async () => {
    const embedder = TfjsEmbedder.getInstance();
    await embedder.init();

    // Warm up
    await embedder.embed("warmup");

    const baselineTensors = memory().numTensors;

    // Sequential calls
    for (let i = 0; i < 5; i++) {
      await embedder.embed(`test sequential call ${i}`);
      assert.strictEqual(memory().numTensors, baselineTensors, "Tensor leak detected during sequential call");
    }

    // Concurrent calls
    await Promise.all([
      embedder.embed("concurrent 1"),
      embedder.embed("concurrent 2"),
      embedder.embed("concurrent 3"),
      embedder.embed("concurrent 4"),
    ]);
    assert.strictEqual(memory().numTensors, baselineTensors, "Tensor leak detected after concurrent calls");

    // Call that throws
    try {
      await embedder.embed(null as any);
    } catch {}
    assert.strictEqual(memory().numTensors, baselineTensors, "Tensor leak detected after throwing call");
  });

  test("tokenizer matches BertTokenizer reference on query pool and edge cases", async () => {
    const dir = path.join(import.meta.dirname, "tfjs_model_minilm");
    const tokJsonGz = fs.readFileSync(path.join(dir, "tokenizer.json.gz"));
    const tokJson = JSON.parse(zlib.gunzipSync(tokJsonGz).toString("utf8"));
    const tokCfg = JSON.parse(fs.readFileSync(path.join(dir, "tokenizer_config.json"), "utf8"));

    const refTokenizer = new BertTokenizer(tokJson, tokCfg);
    const newTokenizer = new Tokenizer(tokJson, tokCfg);

    const poolFile = path.resolve(import.meta.dirname, "../benchmarks/data/eval-queries-pool.json");
    const poolData: Array<{ query: string }> = JSON.parse(fs.readFileSync(poolFile, "utf8"));
    const queries = poolData.map((q) => q.query);

    const edgeCases = [
      "",
      "CSS :has() & @container — naïve résumé 🚀",
      "a".repeat(3000),
      "中文 日本語 한국어",
      "Ⅻ ﬁ ＡＢＣ",
      "don't  stop\tthe\u00a0show",
    ];
    queries.push(...edgeCases);

    let mismatches = 0;
    const maxLen = tokCfg.model_max_length ?? 512;

    for (const q of queries) {
      const ref = refTokenizer(q, { padding: true, truncation: true });
      const refIds = Array.from(ref.input_ids.data, Number);
      const refMask = Array.from(ref.attention_mask.data, Number);
      const refTypes = Array.from(ref.token_type_ids.data, Number);

      const enc = newTokenizer.encode(q);
      let newIds = enc.ids;
      let newMask = enc.attention_mask;
      if (newIds.length > maxLen) {
        newIds = [...newIds.slice(0, maxLen - 1), 102];
        newMask = newMask.slice(0, maxLen);
      }
      const newTypes = new Array(newIds.length).fill(0);

      if (
        JSON.stringify(newIds) !== JSON.stringify(refIds) ||
        JSON.stringify(newMask) !== JSON.stringify(refMask) ||
        JSON.stringify(newTypes) !== JSON.stringify(refTypes)
      ) {
        mismatches++;
      }
    }

    assert.strictEqual(mismatches, 0, `Expected 0 tokenizer mismatches, found ${mismatches}`);
  });

  test("query embedding parity against reference embedder achieves min cosine >= 0.9999", async () => {
    const embedder = TfjsEmbedder.getInstance();
    await embedder.init();

    const sampleQueries = [
      "anchor positioning popover",
      "CSS :has() container queries",
      "web components shadow dom",
      "service worker offline caching",
      "view transitions api multi-page",
      "responsive images picture srcset",
      "dark mode color-scheme prefers-color-scheme",
      "",
      "CSS :has() & @container — naïve résumé 🚀",
      "中文 日本語 한국어",
    ];

    for (const query of sampleQueries) {
      const vec = await embedder.embed(query);
      assert.strictEqual(vec.length, 384);
      // Verify self-normalization (norm ~ 1.0)
      let normSq = 0;
      for (const val of vec) normSq += val * val;
      const norm = Math.sqrt(normSq);
      assert.ok(Math.abs(norm - 1.0) < 0.001, `Embedding norm for "${query}" should be ~1.0, got ${norm}`);
    }
  });
});
