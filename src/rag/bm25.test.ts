import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenize, buildBm25Index, rankBm25, reciprocalRankFusion } from "./bm25.ts";

describe("tokenize", () => {
  it("lowercases, keeps inner hyphens, drops stopwords and single characters", () => {
    assert.deepStrictEqual(tokenize("Style the :user-invalid state of a Form"), ["style", "user-invalid", "state", "form"]);
  });
});

describe("rankBm25", () => {
  const index = buildBm25Index([
    { id: "validation", text: "Use :user-invalid to show validation errors after interaction. user-invalid styling." },
    { id: "images", text: "Optimize LCP images with fetchpriority high." },
    { id: "dialogs", text: "Native dialog element with showModal and light dismiss." },
  ]);

  it("ranks the document containing the rare literal term first and omits non-matching documents", () => {
    assert.deepStrictEqual(rankBm25(index, "form validation user-invalid").map((r) => r.id), ["validation"]);
  });

  it("returns [] when no query term occurs in the corpus", () => {
    assert.deepStrictEqual(rankBm25(index, "kubernetes autoscaling"), []);
  });

  it("throws on an empty corpus", () => {
    assert.throws(() => buildBm25Index([]), /no documents/);
  });

  it("max-pools per id when multiple chunks share a guide id", () => {
    const chunkedIndex = buildBm25Index([
      // Guide 'scattered' has 'query' in chunk 1 and 'terms' in chunk 2
      { id: "scattered", text: "query alpha beta" },
      { id: "scattered", text: "terms gamma delta" },
      // Guide 'focused' has both 'query' and 'terms' co-occurring in a single chunk
      { id: "focused", text: "query terms epsilon zeta" },
      // Extra chunk for 'focused' without query terms
      { id: "focused", text: "unrelated extra chunk" },
    ]);

    const results = rankBm25(chunkedIndex, "query terms");
    // Returns each id at most once
    const ids = results.map((r) => r.id);
    assert.deepStrictEqual(ids, ["focused", "scattered"]);

    // Each id has score from its best chunk; focused beats scattered
    assert.strictEqual(results.length, 2);
    assert.ok(results[0].score > results[1].score);
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards documents ranked well in both lists over a single-list winner", () => {
    const fused = reciprocalRankFusion([["a", "b", "c"], ["b", "d", "a"]]).map((r) => r.id);
    assert.deepStrictEqual(fused.slice(0, 2), ["b", "a"]);
    assert.deepStrictEqual([...fused].sort(), ["a", "b", "c", "d"]);
  });
});
