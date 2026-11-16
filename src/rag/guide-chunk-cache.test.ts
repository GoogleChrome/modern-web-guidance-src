import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeChunkHash,
  truncateAndNormalize256,
  quantizeVectors,
  dequantizeVectorRow,
  loadChunkCache,
  saveChunkCache,
  TEACHER_MODEL,
  TASK_TYPE,
  STATIC_DIMS,
} from "./guide-chunk-cache.ts";
import { scanCorpusChunks } from "../core/guide-chunks.ts";
import { embedGuideChunks } from "./embed-guide-chunks.ts";

describe("guide-chunk-cache", () => {
  it("computeChunkHash produces deterministic hashes sensitive to text and metadata", () => {
    const textA = "guide-a: description\n\nchunk content";
    const textB = "guide-a: description\n\nchunk content modified";

    const hashA1 = computeChunkHash(textA);
    const hashA2 = computeChunkHash(textA);
    const hashB = computeChunkHash(textB);

    assert.strictEqual(hashA1, hashA2, "Identical inputs must yield identical hash");
    assert.notStrictEqual(hashA1, hashB, "Different text must yield different hash");

    const hashDifferentModel = computeChunkHash(textA, "other-model", TASK_TYPE, STATIC_DIMS);
    assert.notStrictEqual(hashA1, hashDifferentModel, "Different model must yield different hash");

    const hashDifferentTask = computeChunkHash(textA, TEACHER_MODEL, "RETRIEVAL_QUERY", STATIC_DIMS);
    assert.notStrictEqual(hashA1, hashDifferentTask, "Different task type must yield different hash");

    const hashDifferentDims = computeChunkHash(textA, TEACHER_MODEL, TASK_TYPE, 128);
    assert.notStrictEqual(hashA1, hashDifferentDims, "Different dims must yield different hash");
  });

  it("truncateAndNormalize256 truncates 768-d to 256-d unit vector", () => {
    const v768 = new Float32Array(768);
    for (let i = 0; i < 768; i++) v768[i] = Math.sin(i + 1);

    const v256 = truncateAndNormalize256(v768);
    assert.strictEqual(v256.length, 256);

    let sumSq = 0;
    for (let i = 0; i < 256; i++) sumSq += v256[i] * v256[i];
    const norm = Math.sqrt(sumSq);
    assert.ok(Math.abs(norm - 1.0) < 1e-6, `Expected unit norm, got ${norm}`);
  });

  it("saveChunkCache and loadChunkCache roundtrips with >0.999 cosine similarity", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunk-cache-test-"));
    try {
      const origMap = new Map<string, Float32Array>();
      const N = 10;
      for (let i = 0; i < N; i++) {
        const hash = computeChunkHash(`test-chunk-${i}`);
        const vec = new Float32Array(STATIC_DIMS);
        for (let k = 0; k < STATIC_DIMS; k++) {
          vec[k] = Math.cos((i + 1) * (k + 1));
        }
        let sumSq = 0;
        for (let k = 0; k < STATIC_DIMS; k++) sumSq += vec[k] * vec[k];
        const norm = Math.sqrt(sumSq) || 1;
        for (let k = 0; k < STATIC_DIMS; k++) vec[k] /= norm;
        origMap.set(hash, vec);
      }

      const saveStats = saveChunkCache(origMap, tmpDir);
      assert.strictEqual(saveStats.count, N);

      const loadedMap = loadChunkCache(tmpDir);
      assert.strictEqual(loadedMap.size, N);

      for (const [hash, origVec] of origMap) {
        const loadedVec = loadedMap.get(hash);
        assert.ok(loadedVec, `Loaded cache must contain hash ${hash}`);

        let dot = 0;
        for (let k = 0; k < STATIC_DIMS; k++) {
          dot += origVec[k] * loadedVec[k];
        }
        assert.ok(
          dot > 0.999,
          `Expected cosine similarity > 0.999, got ${dot} for hash ${hash}`
        );
      }

      // Test pruning: save only first 3 entries
      const subsetMap = new Map<string, Float32Array>([...origMap.entries()].slice(0, 3));
      saveChunkCache(subsetMap, tmpDir);

      const prunedMap = loadChunkCache(tmpDir);
      assert.strictEqual(prunedMap.size, 3, "Pruned cache should only contain 3 entries");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("loadChunkCache handles empty or missing directories cleanly", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "empty-cache-test-"));
    try {
      const result = loadChunkCache(emptyDir);
      assert.strictEqual(result.size, 0);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("quantizeVectors and dequantizeVectorRow handle uncached empty vectors (scale 0) alongside dense vectors", () => {
    const v0 = new Float32Array(STATIC_DIMS);
    v0[0] = 0.6;
    v0[1] = -0.8;
    const { qTable, scales } = quantizeVectors([v0, []], STATIC_DIMS);
    assert.strictEqual(scales.length, 2);
    assert.ok(scales[0] > 0, "Non-empty vector must have positive scale");
    assert.strictEqual(scales[1], 0, "Empty vector must have zero scale");

    const deq0 = dequantizeVectorRow(qTable, scales, 0, STATIC_DIMS);
    assert.strictEqual(deq0.length, STATIC_DIMS);
    assert.ok(Math.abs(deq0[0] - 0.6) < 0.01);
    assert.ok(Math.abs(deq0[1] - -0.8) < 0.01);

    const deq1 = dequantizeVectorRow(qTable, scales, 1, STATIC_DIMS);
    assert.strictEqual(deq1.length, 0, "Zero-scale row must dequantize to empty Float32Array(0)");
  });

  it("loadChunkCache detects corrupted binary files", () => {
    const corruptDir = fs.mkdtempSync(path.join(os.tmpdir(), "corrupt-cache-test-"));
    try {
      fs.writeFileSync(path.join(corruptDir, "guide-chunk-cache.json"), JSON.stringify(["hash1", "hash2"]));
      fs.writeFileSync(path.join(corruptDir, "guide-chunk-cache.i8"), Buffer.alloc(100)); // wrong length
      fs.writeFileSync(path.join(corruptDir, "guide-chunk-cache.scale.f32"), Buffer.alloc(8));

      assert.throws(() => loadChunkCache(corruptDir), /Chunk cache corrupted/);
    } finally {
      fs.rmSync(corruptDir, { recursive: true, force: true });
    }
  });

  it("release check flags missing chunks when cache is empty", async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "empty-cache-check-"));
    try {
      const checkResult = await embedGuideChunks({ check: true, cacheDir: emptyDir });
      assert.ok(checkResult.missing.length > 0, "Release check must flag missing chunks on empty cache");
      assert.strictEqual(checkResult.cachedCount, 0);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("embedGuideChunks is append-only by default and only prunes when prune: true", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunk-cache-prune-test-"));
    try {
      const allChunks = scanCorpusChunks("skills-cli");
      const testCache = new Map<string, Float32Array>();
      const dummyVec = new Float32Array(STATIC_DIMS);
      dummyVec[0] = 1.0;

      // Populate testCache with all current corpus chunks plus a stale chunk
      for (const chunk of allChunks) {
        testCache.set(chunk.hash, dummyVec);
      }
      testCache.set("stale-chunk-hash-123", dummyVec);
      saveChunkCache(testCache, tmpDir);

      // Default run (prune: false) should NOT prune stale entry
      const resDefault = await embedGuideChunks({ cacheDir: tmpDir });
      assert.strictEqual(resDefault.prunedCount, 0, "Default embedGuideChunks must not prune");
      const loadedAfterDefault = loadChunkCache(tmpDir);
      assert.ok(
        loadedAfterDefault.has("stale-chunk-hash-123"),
        "Stale entry must be preserved in append-only mode"
      );

      // Explicit prune: true should prune the stale entry
      const resPruned = await embedGuideChunks({ cacheDir: tmpDir, prune: true });
      assert.strictEqual(resPruned.prunedCount, 1, "embedGuideChunks with prune: true must prune 1 entry");
      const loadedAfterPrune = loadChunkCache(tmpDir);
      assert.ok(
        !loadedAfterPrune.has("stale-chunk-hash-123"),
        "Stale entry must be removed when prune: true"
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
