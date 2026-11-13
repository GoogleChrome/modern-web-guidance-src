import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  filterPublishFiles,
  getNextVersion,
  GH_CLAUDE_PUBLISH_PATTERNS,
  GH_PUBLISH_PATTERNS,
  parsePublishOptions,
  validate,
  type DistTag,
} from './publish-skills.ts';
import { processSkills } from './build-dist.ts';

test('getNextVersion derive from git tag', async () => {
  const mockGetTag = () => 'v0.0.22';
  
  const version = await getNextVersion(mockGetTag);
  assert.strictEqual(version, '0.0.23');
});

test('parsePublishOptions handles flags, env vars, and validation', () => {
  assert.deepStrictEqual(parsePublishOptions([], {}), {
    distTag: 'latest',
    explicitVersion: undefined,
  });

  assert.deepStrictEqual(parsePublishOptions(['--tag', 'next'], {}), {
    distTag: 'next',
    explicitVersion: undefined,
  });

  assert.deepStrictEqual(
    parsePublishOptions(['--tag=latest', '--version=v1.0.0'], {}),
    {
      distTag: 'latest',
      explicitVersion: '1.0.0',
    },
  );

  assert.deepStrictEqual(
    parsePublishOptions([], { DIST_TAG: 'next', RELEASE_VERSION: '1.0.0' }),
    {
      distTag: 'next',
      explicitVersion: '1.0.0',
    },
  );

  assert.deepStrictEqual(
    parsePublishOptions([], { NPM_DIST_TAG: 'next', RELEASE_VERSION: '1.0.0' }),
    {
      distTag: 'next',
      explicitVersion: '1.0.0',
    },
  );

  assert.throws(() => parsePublishOptions(['--tag', 'canary'], {}), /Invalid dist-tag/);
  assert.throws(() => parsePublishOptions(['--version', '1.0'], {}), /Invalid explicit version/);
});

test('processSkills rewrites modern-web-guidance@latest to @next when distTag is next', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mwg-process-skills-'));
  try {
    processSkills(tmpRoot, 'next');
    const nextSkillMd = await fs.readFile(
      path.join(tmpRoot, 'skills/modern-web-guidance/SKILL.md'),
      'utf8',
    );
    assert.ok(nextSkillMd.includes('modern-web-guidance@next search'), 'Should rewrite search to @next');
    assert.ok(!nextSkillMd.includes('modern-web-guidance@latest'), 'Should not retain @latest in next build');

    processSkills(tmpRoot, 'latest');
    const latestSkillMd = await fs.readFile(
      path.join(tmpRoot, 'skills/modern-web-guidance/SKILL.md'),
      'utf8',
    );
    assert.ok(latestSkillMd.includes('modern-web-guidance@latest search'), 'Should keep @latest for latest build');
    assert.ok(!latestSkillMd.includes('modern-web-guidance@next'), 'Should not contain @next in latest build');
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('validate dry-run checks without throwing and allows uncached chunk fallback in buildDist', async () => {
  const embedCalls: Array<{ check?: boolean } | undefined> = [];
  const buildCalls: Array<{ version?: string; failOnMissingVectors?: boolean; distTag?: DistTag }> = [];
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
        distTag: opts.distTag,
      });
      return { skillsCount: 1, skillNames: ['modern-web-guidance'] };
    },
    runDistTests: () => {
      distTestsRan++;
    },
  });

  assert.deepStrictEqual(embedCalls, [{ check: true }]);
  assert.deepStrictEqual(buildCalls, [{ version: '0.0.198', failOnMissingVectors: false, distTag: 'latest' }]);
  assert.strictEqual(distTestsRan, 1);
});

test('validate release embeds missing chunks with prune: true and enforces failOnMissingVectors and distTag', async () => {
  const embedCalls: Array<{ check?: boolean; prune?: boolean } | undefined> = [];
  const buildCalls: Array<{ version?: string; failOnMissingVectors?: boolean; distTag?: DistTag }> = [];

  await validate('0.0.198', {
    dryRun: false,
    distTag: 'next',
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
        distTag: opts.distTag,
      });
      return { skillsCount: 1, skillNames: ['modern-web-guidance'] };
    },
    runDistTests: () => {},
  });

  assert.deepStrictEqual(embedCalls, [{ prune: true }]);
  assert.deepStrictEqual(buildCalls, [{ version: '0.0.198', failOnMissingVectors: true, distTag: 'next' }]);
});

test('GH_CLAUDE_PUBLISH_PATTERNS strips disallowed file types and non-Claude manifests', () => {
  const sampleFiles = [
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    '.codex-plugin/plugin.json',
    '.agents/plugins/marketplace.json',
    '.cursor-plugin/plugin.json',
    '.github/plugin/plugin.json',
    '.github/img/modern-web-guidance.svg',
    '.grok-plugin/marketplace.json',
    '.gitignore',
    'CONTRIBUTING.md',
    'LICENSE',
    'README.md',
    'THIRD_PARTY_NOTICES',
    'assets/logo.png',
    'gemini-extension.json',
    'kimi.plugin.json',
    'package.json',
    'plugin.json',
    'policies/modern-web-guidance.toml',
    'skills/chrome-extensions/SKILL.md',
    'skills/chrome-extensions/references/extensions/popup-ui.md',
    'skills/modern-web-guidance/SKILL.md',
    'skills/modern-web-guidance/guides/forms/autofill.md',
    'skills/modern-web-guidance/guides.json',
    'skills/modern-web-guidance/modern-web.mjs',
    'skills/modern-web-guidance/package.json',
    'skills/modern-web-guidance/skill-version.txt',
    'skills/modern-web-guidance/.cache/notes.md',
    'skills/modern-web-guidance/gen/query-words.json',
  ];

  assert.deepStrictEqual(filterPublishFiles(sampleFiles, GH_CLAUDE_PUBLISH_PATTERNS), [
    '.claude-plugin/plugin.json',
    '.gitignore',
    'assets/logo.png',
    'CONTRIBUTING.md',
    'LICENSE',
    'README.md',
    'skills/chrome-extensions/references/extensions/popup-ui.md',
    'skills/chrome-extensions/SKILL.md',
    'skills/modern-web-guidance/guides/forms/autofill.md',
    'skills/modern-web-guidance/SKILL.md',
  ]);

  const mainFiles = filterPublishFiles(sampleFiles, GH_PUBLISH_PATTERNS);
  assert.ok(mainFiles.includes('package.json'));
  assert.ok(mainFiles.includes('.claude-plugin/marketplace.json'));
  assert.ok(!mainFiles.includes('skills/modern-web-guidance/modern-web.mjs'));
});


