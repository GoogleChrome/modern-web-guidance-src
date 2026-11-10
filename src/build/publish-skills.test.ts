import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getNextVersion, parsePublishOptions, validate } from './publish-skills.ts';
import { processSkills } from './build-dist.ts';

test('getNextVersion derive from git tag', async () => {
  const mockGetTag = () => 'v0.0.22';
  
  const version = await getNextVersion(mockGetTag);
  assert.strictEqual(version, '0.0.23');
});

test('parsePublishOptions handles flags, env vars, and validation', () => {
  assert.deepStrictEqual(parsePublishOptions([], {}), {
    explicitVersion: undefined,
  });

  assert.deepStrictEqual(
    parsePublishOptions(['--version=v1.0.0'], {}),
    {
      explicitVersion: '1.0.0',
    },
  );

  assert.deepStrictEqual(
    parsePublishOptions([], { RELEASE_VERSION: '1.0.0' }),
    {
      explicitVersion: '1.0.0',
    },
  );

  assert.throws(() => parsePublishOptions(['--version', '1.0'], {}), /Invalid explicit version/);
});

test('processSkills copies standalone skills and preserves modern-web-guidance@latest', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mwg-process-skills-'));
  try {
    processSkills(tmpRoot);
    const skillMd = await fs.readFile(
      path.join(tmpRoot, 'skills/modern-web-guidance/SKILL.md'),
      'utf8',
    );
    assert.ok(skillMd.includes('modern-web-guidance@latest search'), 'Should keep @latest in build');
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('validate dry-run checks without throwing and allows uncached chunk fallback in buildDist', async () => {
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
            embeddedText: 'chunk',
            hash: 'abc',
          },
        ],
      };
    },
    runBuildDist: async (opts) => {
      buildCalls.push({
        version: opts.version,
        failOnMissingVectors: opts.failOnMissingVectors,
      });
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

test('validate release embeds missing chunks with prune: true and enforces failOnMissingVectors', async () => {
  const embedCalls: Array<{ check?: boolean; prune?: boolean } | undefined> = [];
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
      buildCalls.push({
        version: opts.version,
        failOnMissingVectors: opts.failOnMissingVectors,
      });
      return { skillsCount: 1, skillNames: ['modern-web-guidance'] };
    },
    runDistTests: () => {},
  });

  assert.deepStrictEqual(embedCalls, [{ prune: true }]);
  assert.deepStrictEqual(buildCalls, [{ version: '0.0.198', failOnMissingVectors: true }]);
});


