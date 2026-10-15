import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { memory } from "@tensorflow/tfjs-core";
import { BertTokenizer } from "@huggingface/transformers";
import { Tokenizer } from "@huggingface/tokenizers";
import { TfjsEmbedder } from "./tfjs-embedder.ts";
import { rootDir } from "../core/paths.ts";

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

    // Call that throws during prediction (verifies tensor disposal in finally block)
    const { model } = await embedder.init();
    const origPredict = model.predict;
    model.predict = () => {
      throw new Error("Simulated prediction fault");
    };
    try {
      await embedder.embed("valid input that fails during predict");
      assert.fail("Should have thrown simulated prediction fault");
    } catch (err: unknown) {
      assert.ok(err instanceof Error && err.message === "Simulated prediction fault");
    } finally {
      model.predict = origPredict;
    }
    assert.strictEqual(memory().numTensors, baselineTensors, "Tensor leak detected after predict failure");
  });

  test("supports concurrent init and concurrent initial embed calls safely", async () => {
    TfjsEmbedder.clearInstance();
    const embedder = TfjsEmbedder.getInstance();
    const [res1, res2] = await Promise.all([
      embedder.embed("concurrent init query 1"),
      embedder.embed("concurrent init query 2"),
    ]);
    assert.strictEqual(res1.length, 384);
    assert.strictEqual(res2.length, 384);
    for (const val of res1) {
      assert.ok(Number.isFinite(val), "Embedding values must be finite numbers");
    }
    for (const val of res2) {
      assert.ok(Number.isFinite(val), "Embedding values must be finite numbers");
    }
  });

  test("tokenizer matches BertTokenizer reference on query pool and edge cases", async () => {
    const dir = path.join(import.meta.dirname, "tfjs-model-minilm");
    const tokJsonGz = fs.readFileSync(path.join(dir, "tokenizer.json.gz"));
    const tokJson = JSON.parse(zlib.gunzipSync(tokJsonGz).toString("utf8"));
    const tokCfg = JSON.parse(fs.readFileSync(path.join(dir, "tokenizer_config.json"), "utf8"));

    const refTokenizer = new BertTokenizer(tokJson, tokCfg);
    const newTokenizer = new Tokenizer(tokJson, tokCfg);

    const poolFile = path.join(rootDir, "src/rag/benchmarks/data/eval-queries-pool.json");
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
      const refTypes = ref.token_type_ids ? Array.from(ref.token_type_ids.data, Number) : Array.from({ length: refIds.length }, () => 0);

      const enc = newTokenizer.encode(q);
      let newIds = enc.ids;
      let newMask = enc.attention_mask;
      if (newIds.length > maxLen) {
        newIds = [...newIds.slice(0, maxLen - 1), 102];
        newMask = newMask.slice(0, maxLen);
      }
      const newTypes = Array.from({ length: newIds.length }, () => 0);

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

  test("query embedding parity against reference embedder achieves cosine similarity >= 0.95", async () => {
    const embedder = TfjsEmbedder.getInstance();
    await embedder.init();

    const { Embedder } = await import("./transformers-embedder.ts");
    const refEmbedder = Embedder.getInstance("Xenova/all-MiniLM-L6-v2@q8");
    await refEmbedder.init();

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
      const refVec = await refEmbedder.embed(query);
      assert.strictEqual(vec.length, 384);
      const sim = cosineSimilarity(vec, refVec);
      assert.ok(sim >= 0.95, `Embedding cosine similarity for "${query}" should be >= 0.95, got ${sim}`);
    }
  });

  test("truncates sequences exceeding model_max_length to a valid 384-dim finite vector", async () => {
    const embedder = TfjsEmbedder.getInstance();
    await embedder.init();
    const longInput = "tokenizer sequence truncation test ".repeat(100); // ~400 words, >512 tokens
    const embedding = await embedder.embed(longInput);
    assert.strictEqual(embedding.length, 384, "Embedding should have dimension 384");
    for (const val of embedding) {
      assert.ok(Number.isFinite(val), "Embedding values must be finite numbers");
    }
    let normSq = 0;
    for (const val of embedding) normSq += val * val;
    const norm = Math.sqrt(normSq);
    assert.ok(Math.abs(norm - 1.0) < 0.001, `Embedding norm should be ~1.0, got ${norm}`);
  });
});
