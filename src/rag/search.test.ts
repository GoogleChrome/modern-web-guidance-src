import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { outDir } from "../core/paths.ts";
import { searchUseCases, type UseCaseVector, type EmbedderLike } from "./search.ts";

describe("searchUseCases", () => {
  it("should return autofill-address-form as the best match for 'autofill address form'", async () => {
    const results = await searchUseCases("autofill address form");
    assert.ok(results.length > 0, "Should return some results");
    
    const bestMatch = results[0];
    assert.strictEqual(bestMatch.id, "autofill-address-form", "Best match should be autofill-address-form");
    
    const similarity = bestMatch.similarity;
    assert.ok(similarity > 0.3, `Similarity ${similarity} should be greater than 0.3`);
    assert.ok(bestMatch.tokenCount > 0, 'Best match should have tokenCount > 0');
  });

  it("corpus vectors are all L2-normalized unit vectors (norm ~ 1.0)", () => {
    const vectorsFile = path.join(outDir, "build/skills-cli/use-cases.vectors.gen.json.gz");
    const compressed = fs.readFileSync(vectorsFile);
    const items: UseCaseVector[] = JSON.parse(zlib.gunzipSync(compressed).toString("utf-8"));
    assert.ok(items.length > 0, "Corpus must have vector entries");

    for (const item of items) {
      let sumSq = 0;
      for (const val of item.vector) {
        sumSq += val * val;
      }
      const norm = Math.sqrt(sumSq);
      assert.ok(
        Math.abs(norm - 1.0) < 0.001,
        `Corpus vector for "${item.id}" must be unit length, got norm ${norm}`
      );
    }
  });

  it("works with a custom mock EmbedderLike", async () => {
    const mockEmbedder: EmbedderLike = {
      embed: async () => Array.from({ length: 384 }, () => 0),
    };
    const results = await searchUseCases("test query", 5, 0.0, mockEmbedder);
    assert.ok(Array.isArray(results));
  });

  it("returns empty array when top-1 similarity is below top1MinSimilarity", async () => {
    const mockEmbedder: EmbedderLike = {
      embed: async () => Array.from({ length: 384 }, () => 0),
    };
    const results = await searchUseCases("test query", 5, 0.0, mockEmbedder, {
      top1MinSimilarity: 0.38,
    });
    assert.strictEqual(results.length, 0);
  });

  it("prunes weak tail results that exceed maxDropFromTop1 while keeping high-confidence matches", async () => {
    // "WebAssembly canvas render" hits expose-canvas-content-to-browser-features at >0.60 and cpp-on-the-web at >=0.42
    const results = await searchUseCases("WebAssembly canvas render", 5);
    assert.ok(results.length > 0, "Should return results for WebAssembly canvas render");
    assert.ok(results[0].similarity >= 0.38, "Top-1 result must clear 0.38");
    for (let i = 1; i < results.length; i++) {
      const r = results[i];
      assert.ok(r.similarity >= 0.35, `Result ${r.id} (${r.similarity}) must clear 0.35 floor`);
      assert.ok(
        r.similarity >= 0.42 || results[0].similarity - r.similarity <= 0.1201,
        `Result ${r.id} (${r.similarity}) must either be >= 0.42 or within 0.12 of top-1 (${results[0].similarity})`
      );
    }
  });
});
