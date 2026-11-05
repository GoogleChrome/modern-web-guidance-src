import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { StaticEmbedder, STATIC_EMBEDDING_DIMS } from "./static-embedder.ts";
import { dotProduct } from "./search.ts";
import { quantizeAndExportStaticModel } from "./train-static-model.ts";

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

test("StaticEmbedder ranks semantically related web queries higher than unrelated queries", () => {
  const embedder = StaticEmbedder.getInstance();
  const qAutofill = embedder.embedSync("autofill shipping address form autocomplete");
  const qPopover = embedder.embedSync("html autocomplete postal-code address-line1");
  const qWebgl = embedder.embedSync("webgl fragment shader matrix uniform buffer");

  const simRelated = dotProduct(qAutofill, qPopover);
  const simUnrelated = dotProduct(qAutofill, qWebgl);
  assert.ok(
    simRelated > simUnrelated + 0.15,
    `Expected related similarity (${simRelated.toFixed(4)}) > unrelated (${simUnrelated.toFixed(4)}) + 0.15`
  );
});

test("quantizeAndExportStaticModel preserves Float32 cosine similarity within > 0.999", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "static-model-test-"));
  try {
    const words = ["address", "animation", "autofill", "container", "css", "dialog", "form", "modal", "popover", "scroll", "shader", "transition", "view", "webgl"];
    const V = words.length;
    const D = STATIC_EMBEDDING_DIMS;
    const E = new Float32Array(V * D);
    const W = new Float32Array(V);

    let seed = 42;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

    for (let i = 0; i < V; i++) {
      let norm = 0;
      for (let k = 0; k < D; k++) {
        const val = rand() * 2 - 1;
        E[i * D + k] = val;
        norm += val * val;
      }
      norm = Math.sqrt(norm) || 1;
      for (let k = 0; k < D; k++) {
        E[i * D + k] /= norm;
      }
      W[i] = 1 + rand() * 4;
    }

    const res = quantizeAndExportStaticModel(words, E, W, tmpDir);
    assert.strictEqual(res.vocabSize, V);
    assert.strictEqual(res.dims, D);
    assert.ok(res.minCosine > 0.999, `Expected minCosine > 0.999, got ${res.minCosine}`);
    assert.ok(res.maxAbsDiff < 0.015, `Expected maxAbsDiff < 0.015, got ${res.maxAbsDiff}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
