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
  withGitHubPackageManifest,
} from './publish-skills.ts';
import { processSkills } from './build-dist.ts';

for (const fails of [false, true]) {
  test(`GitHub publishing omits the missing CLI bin and restores npm metadata after ${fails ? 'failure' : 'success'}`, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'guidance-manifest-'));
    const packagePath = path.join(dir, 'package.json');
    const manifest = {
      name: 'modern-web-guidance',
      version: '1.0.0',
      bin: { 'modern-web-guidance': 'skills/modern-web-guidance/modern-web.mjs' },
      contributes: { chatSkills: [{ path: './skills/modern-web-guidance/SKILL.md' }] },
    };
    const original = JSON.stringify(manifest, null, 2) + '\n';
    const failure = new Error('publish failed');
    try {
      await fs.writeFile(packagePath, original);
      const publishing = withGitHubPackageManifest(dir, async () => {
        const actual = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        assert.deepStrictEqual(actual, {
          name: manifest.name,
          version: manifest.version,
          contributes: manifest.contributes,
        });
        if (fails) throw failure;
      });
      if (fails) await assert.rejects(publishing, (error) => error === failure);
      else await publishing;
      assert.strictEqual(await fs.readFile(packagePath, 'utf8'), original);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}

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


