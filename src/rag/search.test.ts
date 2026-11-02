import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { outDir } from "../core/paths.ts";
import { searchUseCases, type UseCaseVector, type EmbedderLike } from "./search.ts";

describe("searchUseCases", () => {
  it("should return autofill-address-form as the best match for 'autofill address form'", async () => {
    const results = await searchUseCases("autofill address form");
    assert.strictEqual(results.length, 10, "Default search should return top-10 results");
    
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

  it("returns empty array when dense top-1 is below floor AND BM25 has no matches", async () => {
    const mockEmbedder: EmbedderLike = {
      embed: async () => Array.from({ length: 384 }, () => 0),
    };
    // Nonce query with zero BM25 lexical matches in the guide corpus
    const results = await searchUseCases("xyznonexistentunmatchedterm998877", 5, 0.3, mockEmbedder);
    assert.strictEqual(results.length, 0);
  });

  it("fuses and returns results when dense is below floor but BM25 matches", async () => {
    const zeroEmbedder: EmbedderLike = {
      embed: async () => Array.from({ length: 384 }, () => 0),
    };
    // Dense similarity is 0 (below 0.3 floor), but BM25 matches "autofill address form".
    const results = await searchUseCases("autofill address form", 5, 0.3, zeroEmbedder);
    assert.ok(results.length > 0, "Should return BM25 matches even when dense similarity is 0");
    const match = results.find((r) => r.id === "autofill-address-form");
    assert.ok(match, "BM25 should surface autofill-address-form");
    assert.strictEqual(match.similarity, 0, "Zero dense similarity is preserved on BM25-surfaced result");
  });

  it("excludes sub-floor dense list and returns only BM25 matches when topDenseSim < minSimilarity", async () => {
    const zeroEmbedder: EmbedderLike = {
      embed: async () => Array.from({ length: 384 }, () => 0),
    };
    // "i18n pluralization" has 1 BM25 match and 0 dense similarity (below floor).
    // When dense is below floor, only BM25 matches are returned without sub-floor dense padding.
    const results = await searchUseCases("i18n pluralization", 10, 0.3, zeroEmbedder);
    assert.strictEqual(results.length, 1, "Should return only the BM25 match, not padded to limit=10");
    assert.strictEqual(results[0].id, "state-aware-sticky-headers");
    assert.strictEqual(results[0].similarity, 0);
  });

  it("above-floor behavior is unchanged and preserves dense similarities", async () => {
    const results = await searchUseCases("autofill address form", 5, 0.3);
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].id, "autofill-address-form");
    assert.ok(results[0].similarity > 0.3);
  });

  it("keeps sibling guides on a cluster query", async () => {
    const ids = (await searchUseCases("tooltip on hover")).map((r) => r.id);
    assert.ok(
      ids.includes("hovercard") && ids.includes("interest-triggered-tooltips"),
      `Expected both tooltip siblings, got: ${ids.join(", ")}`
    );
  });
});
