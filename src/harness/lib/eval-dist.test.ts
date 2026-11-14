import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureGuidedEvalDist } from './eval-dist.ts';
import type { GuideChunk } from '../../core/guide-chunks.ts';

describe('ensureGuidedEvalDist', () => {
  it('uses defaultCacheDir and skips embedding when all chunks are cached', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-dist-cached-'));
    try {
      const defaultCacheDir = path.join(tmpRoot, 'default');
      const evalCacheDir = path.join(tmpRoot, 'eval');
      const publishRoot = path.join(tmpRoot, 'dist');
      const embedCalls: Array<{ check?: boolean; cacheDir?: string; seedCacheDir?: string; prune?: boolean }> = [];
      const buildCalls: Array<{ failOnMissingVectors?: boolean; chunkCacheDir?: string; publishRoot: string }> = [];

      const res = await ensureGuidedEvalDist({
        defaultCacheDir,
        evalCacheDir,
        publishRoot,
        getVersion: () => '1.2.3',
        embedChunks: async (opts = {}) => {
          embedCalls.push(opts);
          return { totalChunks: 10, cachedCount: 10, newEmbeds: 0, prunedCount: 0, missing: [] };
        },
        runBuildDist: async (opts) => {
          buildCalls.push(opts);
          return undefined;
        },
      });

      assert.strictEqual(embedCalls.length, 1);
      assert.deepStrictEqual(embedCalls[0], { check: true, cacheDir: defaultCacheDir });
      assert.strictEqual(buildCalls.length, 1);
      assert.deepStrictEqual(buildCalls[0], {
        publishRoot,
        version: '1.2.3',
        failOnMissingVectors: true,
        chunkCacheDir: defaultCacheDir,
      });
      assert.deepStrictEqual(res, { chunkCacheDir: defaultCacheDir, embeddedNewChunks: 0 });
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('embeds missing chunks into evalCacheDir seeded from defaultCacheDir and passes it to buildDist', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-dist-missing-'));
    try {
      const defaultCacheDir = path.join(tmpRoot, 'default');
      const evalCacheDir = path.join(tmpRoot, 'eval');
      const publishRoot = path.join(tmpRoot, 'dist');
      const missingChunk: GuideChunk = {
        guideId: 'js',
        category: 'js',
        embeddedText: 'js chunk',
        hash: 'missing-hash',
      };
      const embedCalls: Array<{ check?: boolean; cacheDir?: string; seedCacheDir?: string; prune?: boolean }> = [];
      const buildCalls: Array<{ failOnMissingVectors?: boolean; chunkCacheDir?: string }> = [];

      const res = await ensureGuidedEvalDist({
        defaultCacheDir,
        evalCacheDir,
        publishRoot,
        getVersion: () => '1.2.3',
        embedChunks: async (opts = {}) => {
          embedCalls.push(opts);
          if (opts.check) {
            return { totalChunks: 10, cachedCount: 9, newEmbeds: 0, prunedCount: 0, missing: [missingChunk] };
          }
          return { totalChunks: 10, cachedCount: 10, newEmbeds: 1, prunedCount: 0, missing: [] };
        },
        runBuildDist: async (opts) => {
          buildCalls.push(opts);
          return undefined;
        },
      });

      assert.strictEqual(embedCalls.length, 2);
      assert.deepStrictEqual(embedCalls[1], {
        cacheDir: evalCacheDir,
        seedCacheDir: defaultCacheDir,
        prune: true,
      });
      assert.strictEqual(buildCalls.length, 1);
      assert.strictEqual(buildCalls[0].failOnMissingVectors, true);
      assert.strictEqual(buildCalls[0].chunkCacheDir, evalCacheDir);
      assert.deepStrictEqual(res, { chunkCacheDir: evalCacheDir, embeddedNewChunks: 1 });
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('propagates missing GEMINI_API_KEY errors without calling buildDist', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-dist-error-'));
    try {
      let buildCalled = false;
      const missingChunk: GuideChunk = {
        guideId: 'js',
        category: 'js',
        embeddedText: 'js chunk',
        hash: 'missing-hash',
      };

      await assert.rejects(
        () =>
          ensureGuidedEvalDist({
            defaultCacheDir: path.join(tmpRoot, 'default'),
            evalCacheDir: path.join(tmpRoot, 'eval'),
            publishRoot: path.join(tmpRoot, 'dist'),
            embedChunks: async (opts = {}) => {
              if (opts.check) {
                return { totalChunks: 1, cachedCount: 0, newEmbeds: 0, prunedCount: 0, missing: [missingChunk] };
              }
              throw new Error('GEMINI_API_KEY is required (js)');
            },
            runBuildDist: async () => {
              buildCalled = true;
              return undefined;
            },
          }),
        /GEMINI_API_KEY is required \(js\)/
      );

      assert.strictEqual(buildCalled, false);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
