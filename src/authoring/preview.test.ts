import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { rootDir, baseAppsDir } from '../core/paths.ts';
import type { TaskInfo } from '../core/guide-validation.ts';
import { resolvePreviewTarget, startPatchPreview } from './preview.ts';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-test-'));
  const patches = path.join(dir, 'targets', 'custom-task', 'patches');
  fs.mkdirSync(patches, { recursive: true });
  const baseline = path.join(patches, 'zero-passrate.patch');
  const solution = path.join(patches, 'claude-solution.patch');
  fs.writeFileSync(baseline, '');
  fs.writeFileSync(solution, '');
  const tasks = new Map<string, TaskInfo>([
    ['example/custom-task', { baseApp: 'daily-grind', guideDir: dir, prompt: 'test' }],
  ]);
  return { dir, baseline, solution, tasks, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const baselinePatch = 'diff --git a/preview.html b/preview.html\nnew file mode 100644\n--- /dev/null\n+++ b/preview.html\n@@ -0,0 +1 @@\n+<h1>Baseline</h1>\n';
const solutionPatch = 'diff --git a/preview.html b/preview.html\n--- a/preview.html\n+++ b/preview.html\n@@ -1 +1 @@\n-<h1>Baseline</h1>\n+<h1>Solution</h1>\n';

test('resolves base app from task metadata and rejects missing or unregistered patches', () => {
  const f = fixture();
  try {
    const target = resolvePreviewTarget(f.solution, f.tasks);
    assert.equal(target.baseApp, 'daily-grind');
    assert.equal(target.zeroPassrateFile, f.baseline);
    assert.throws(() => resolvePreviewTarget(path.join(f.dir, 'missing.patch'), f.tasks), /existing .patch/);
    assert.throws(() => resolvePreviewTarget(f.dir, f.tasks), /existing .patch/);
    assert.throws(() => resolvePreviewTarget(f.solution, new Map()), /No registered guide target/);
  } finally { f.cleanup(); }
});

test('serves solution after baseline, preserves sources, and cleans up on repeated stop', async () => {
  const f = fixture();
  fs.writeFileSync(f.baseline, baselinePatch);
  fs.writeFileSync(f.solution, solutionPatch);
  const sourcePackage = fs.readFileSync(path.join(baseAppsDir, 'daily-grind', 'package.json'), 'utf8');
  try {
    const preview = await startPatchPreview(resolvePreviewTarget(f.solution, f.tasks));
    try {
      const response = await fetch(new URL('preview.html', preview.url));
      assert.equal(response.status, 200);
      assert.equal((await response.text()).trim(), '<h1>Solution</h1>');
      assert.equal(fs.readFileSync(f.solution, 'utf8'), solutionPatch);
      assert.equal(fs.readFileSync(f.baseline, 'utf8'), baselinePatch);
      assert.equal(fs.readFileSync(path.join(baseAppsDir, 'daily-grind', 'package.json'), 'utf8'), sourcePackage);
      assert.equal(fs.existsSync(path.join(baseAppsDir, 'daily-grind', 'preview.html')), false);
    } finally { await preview.stop(); }
    await preview.stop();
    assert.equal(fs.existsSync(path.dirname(preview.workDir)), false);
    await assert.rejects(() => fetch(preview.url));
  } finally { f.cleanup(); }
});

test('previews the baseline only once and accepts empty or absent baselines', async () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.baseline, baselinePatch);
    const baseline = await startPatchPreview(resolvePreviewTarget(f.baseline, f.tasks));
    try {
      assert.equal((await (await fetch(new URL('preview.html', baseline.url))).text()).trim(), '<h1>Baseline</h1>');
    } finally { await baseline.stop(); }
    for (const missing of [false, true]) {
      if (missing) fs.unlinkSync(f.baseline);
      else fs.writeFileSync(f.baseline, '');
      fs.writeFileSync(f.solution, baselinePatch);
      const preview = await startPatchPreview(resolvePreviewTarget(f.solution, f.tasks));
      try {
        assert.equal((await fetch(new URL('preview.html', preview.url))).status, 200);
      } finally { await preview.stop(); }
    }
    fs.writeFileSync(f.baseline, '');
    const empty = await startPatchPreview(resolvePreviewTarget(f.baseline, f.tasks));
    try { assert.equal((await fetch(empty.url)).status, 200); }
    finally { await empty.stop(); }
  } finally { f.cleanup(); }
});

test('reports patch and startup errors and removes failed staging workspaces', async () => {
  const f = fixture();
  const temporaryPreviews = () => fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('gd-preview-')).sort();
  try {
    const before = temporaryPreviews();
    fs.writeFileSync(f.solution, 'invalid patch');
    await assert.rejects(() => startPatchPreview(resolvePreviewTarget(f.solution, f.tasks)), /Failed to apply/);
    assert.deepEqual(temporaryPreviews(), before);
    const packageLines = fs.readFileSync(path.join(baseAppsDir, 'daily-grind', 'package.json'), 'utf8').trimEnd().split(/\r?\n/);
    fs.writeFileSync(f.solution, `diff --git a/package.json b/package.json\ndeleted file mode 100644\n--- a/package.json\n+++ /dev/null\n@@ -1,${packageLines.length} +0,0 @@\n${packageLines.map(line => `-${line}`).join('\n')}\n`);
    await assert.rejects(() => startPatchPreview(resolvePreviewTarget(f.solution, f.tasks)), /package.json not found/);
    assert.deepEqual(temporaryPreviews(), before);
    // A missing base app must fail before staging anything.
    await assert.rejects(() => startPatchPreview({ ...resolvePreviewTarget(f.solution, f.tasks), baseApp: 'missing-preview-base-app' }), /Base app not found/);
    assert.deepEqual(temporaryPreviews(), before);
  } finally { f.cleanup(); }
});

test('gd help documents preview and missing or invalid paths return nonzero', () => {
  const cli = path.join(rootDir, 'bin', 'gd.ts');
  const run = (args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: rootDir, encoding: 'utf8' });
  const help = run(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /preview.*<patch>/);
  assert.match(run(['preview']).stderr, /gd preview/);
  assert.equal(run(['preview']).status, 1);
  assert.equal(run(['preview', 'not-a-patch']).status, 1);
});
