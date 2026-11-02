import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenize, stemEnglishMinimal, buildBm25Index, rankBm25, reciprocalRankFusion } from "./bm25.ts";

describe("tokenize", () => {
  it("lowercases, keeps inner hyphens, drops stopwords and single characters (pinned to origin/main)", () => {
    assert.deepStrictEqual(tokenize("Style the :user-invalid state of a Form"), [
      "style",
      "user-invalid",
      "state",
      "form",
    ]);
  });

  it("leaves compound terms, plural endings, and tokens unstemmed for static embedder compatibility", () => {
    assert.deepStrictEqual(tokenize("overscroll-behavior queries backdrops"), [
      "overscroll-behavior",
      "queries",
      "backdrops",
    ]);
  });
});

describe("stemEnglishMinimal", () => {
  // Ported from Apache Lucene org.apache.lucene.analysis.en.TestEnglishMinimalStemFilter
  it("matches Lucene TestEnglishMinimalStemFilter test vectors", () => {
    assert.strictEqual(stemEnglishMinimal("queries"), "query");
    assert.strictEqual(stemEnglishMinimal("phrases"), "phrase");
    assert.strictEqual(stemEnglishMinimal("corpus"), "corpus");
    assert.strictEqual(stemEnglishMinimal("stress"), "stress");
    assert.strictEqual(stemEnglishMinimal("kings"), "king");
    assert.strictEqual(stemEnglishMinimal("panels"), "panel");
    assert.strictEqual(stemEnglishMinimal("aerodynamics"), "aerodynamic");
    assert.strictEqual(stemEnglishMinimal("congress"), "congress");
    assert.strictEqual(stemEnglishMinimal("serious"), "serious");
  });

  it("leaves words shorter than 3 characters or not ending in s untouched", () => {
    assert.strictEqual(stemEnglishMinimal(""), "");
    assert.strictEqual(stemEnglishMinimal("a"), "a");
    assert.strictEqual(stemEnglishMinimal("is"), "is");
    assert.strictEqual(stemEnglishMinimal("as"), "as");
    assert.strictEqual(stemEnglishMinimal("us"), "us");
    assert.strictEqual(stemEnglishMinimal("js"), "js");
    assert.strictEqual(stemEnglishMinimal("dialog"), "dialog");
  });

  it("handles -es fallthrough and guarded vowel cases", () => {
    // -ees, -oes, -aes are guarded from dropping s
    assert.strictEqual(stemEnglishMinimal("trees"), "trees");
    assert.strictEqual(stemEnglishMinimal("shoes"), "shoes");
    // Other -es words fall through and drop the final s
    assert.strictEqual(stemEnglishMinimal("styles"), "style");
    assert.strictEqual(stemEnglishMinimal("axes"), "axe");
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

  it("matches singular and plural queries in both directions", () => {
    const pluralIndex = buildBm25Index([
      { id: "popover-doc", text: "Native popover element supports light dismiss and backdrop styling." },
      { id: "dialog-doc", text: "Manage modal dialogs with multiple backdrops." },
    ]);

    // Plural query matches singular in document
    assert.deepStrictEqual(rankBm25(pluralIndex, "popovers").map((r) => r.id), ["popover-doc"]);

    // Singular query matches plural in document
    assert.deepStrictEqual(rankBm25(pluralIndex, "dialog").map((r) => r.id), ["dialog-doc"]);

    // Both documents match queries for backdrops / backdrop
    const pluralQueryResults = rankBm25(pluralIndex, "backdrops").map((r) => r.id);
    assert.ok(pluralQueryResults.includes("popover-doc"));
    assert.ok(pluralQueryResults.includes("dialog-doc"));
    assert.strictEqual(pluralQueryResults.length, 2);

    const singularQueryResults = rankBm25(pluralIndex, "backdrop").map((r) => r.id);
    assert.ok(singularQueryResults.includes("popover-doc"));
    assert.ok(singularQueryResults.includes("dialog-doc"));
    assert.strictEqual(singularQueryResults.length, 2);
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards documents ranked well in both lists over a single-list winner", () => {
    const fused = reciprocalRankFusion([["a", "b", "c"], ["b", "d", "a"]]).map((r) => r.id);
    assert.deepStrictEqual(fused.slice(0, 2), ["b", "a"]);
    assert.deepStrictEqual([...fused].sort(), ["a", "b", "c", "d"]);
  });
});
