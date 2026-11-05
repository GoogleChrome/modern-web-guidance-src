import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextVersion, validate } from './publish-skills.ts';

test('getNextVersion derive from git tag', async () => {
  const mockGetTag = () => 'v0.0.22';
  
  const version = await getNextVersion(mockGetTag);
  assert.strictEqual(version, '0.0.23');
});

test('validate dry-run checks without throwing and allows StaticEmbedder fallback in buildDist', async () => {
  const embedCalls: Array<{ check?: boolean } | undefined> = [];
  const buildCalls: Array<{ version?: string; failOnMissingVectors?: boolean }> = [];
  let distTestsRan = 0;

  await validate('0.0.198', {
    dryRun: true,
    embedChunks: async (opts) => {
      embedCalls.push(opts);
      return {
        totalChunks: 10,
        cachedCount: 8,
        newEmbeds: 0,
        prunedCount: 0,
        missing: [
          {
            guideId: 'example-guide',
            category: 'css',
            description: 'Example',
            featuresUsed: [],
            chunkContent: 'chunk',
            embeddedText: 'chunk',
            hash: 'abc',
          },
        ],
      };
    },
    runBuildDist: async (opts) => {
      buildCalls.push({ version: opts.version, failOnMissingVectors: opts.failOnMissingVectors });
      return { skillsCount: 1, skillNames: ['modern-web-guidance'] };
    },
    runDistTests: () => {
      distTestsRan++;
    },
  });

  assert.deepStrictEqual(embedCalls, [{ check: true }]);
  assert.deepStrictEqual(buildCalls, [{ version: '0.0.198', failOnMissingVectors: false }]);
  assert.strictEqual(distTestsRan, 1);
});

test('validate release embeds missing chunks and enforces failOnMissingVectors', async () => {
  const embedCalls: Array<{ check?: boolean } | undefined> = [];
  const buildCalls: Array<{ version?: string; failOnMissingVectors?: boolean }> = [];

  await validate('0.0.198', {
    dryRun: false,
    embedChunks: async (opts) => {
      embedCalls.push(opts);
      return {
        totalChunks: 10,
        cachedCount: 10,
        newEmbeds: 2,
        prunedCount: 0,
        missing: [],
      };
    },
    runBuildDist: async (opts) => {
      buildCalls.push({ version: opts.version, failOnMissingVectors: opts.failOnMissingVectors });
      return { skillsCount: 1, skillNames: ['modern-web-guidance'] };
    },
    runDistTests: () => {},
  });

  assert.deepStrictEqual(embedCalls, [undefined]);
  assert.deepStrictEqual(buildCalls, [{ version: '0.0.198', failOnMissingVectors: true }]);
});


