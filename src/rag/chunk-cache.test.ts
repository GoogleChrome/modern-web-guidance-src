import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeChunkHash,
  truncateAndNormalize256,
  loadChunkCache,
  saveChunkCache,
  scanCorpusChunks,
  TEACHER_MODEL,
  TASK_TYPE,
  STATIC_DIMS,
} from "./chunk-cache.ts";
import { embedGuideChunks } from "./embed-chunks.ts";

describe("chunk-cache", () => {
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

  it("loadChunkCache detects corrupted binary files", () => {
    const corruptDir = fs.mkdtempSync(path.join(os.tmpdir(), "corrupt-cache-test-"));
    try {
      fs.writeFileSync(path.join(corruptDir, "chunks.json"), JSON.stringify(["hash1", "hash2"]));
      fs.writeFileSync(path.join(corruptDir, "chunks.i8"), Buffer.alloc(100)); // wrong length
      fs.writeFileSync(path.join(corruptDir, "chunks.scale.f32"), Buffer.alloc(8));

      assert.throws(() => loadChunkCache(corruptDir), /Chunk cache corrupted/);
    } finally {
      fs.rmSync(corruptDir, { recursive: true, force: true });
    }
  });

  it("committed repo chunk cache covers 100% of corpus chunks with zero missing", () => {
    const allChunks = scanCorpusChunks("skills-cli");
    assert.ok(allChunks.length > 1500, `Expected >1500 chunks, got ${allChunks.length}`);

    const cache = loadChunkCache();
    assert.strictEqual(cache.size, allChunks.length, "Cache size must match corpus chunk count");

    const missing = allChunks.filter((c) => !cache.has(c.hash));
    assert.strictEqual(
      missing.length,
      0,
      `All chunks must have cached vectors, missing: ${missing.map((m) => m.guideId).join(", ")}`
    );
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

  it("release check passes against committed cache", async () => {
    const checkResult = await embedGuideChunks({ check: true });
    assert.strictEqual(checkResult.missing.length, 0, "Release check must pass on committed cache");
    assert.ok(checkResult.cachedCount > 1500);
  });
});
