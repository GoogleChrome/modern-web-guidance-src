import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkGraderGoldenSelectorCoupling } from './selector-probe.ts';

describe('checkGraderGoldenSelectorCoupling', () => {
  function setupFixture(t: import('node:test').TestContext) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'selector-coupling-'));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    const baseAppDir = path.join(tmp, 'base');
    fs.mkdirSync(baseAppDir, { recursive: true });
    fs.writeFileSync(path.join(baseAppDir, 'index.html'), '<div class="base-card" id="main-grid"></div>');
    const claudePatch = path.join(tmp, 'claude-solution.patch');
    const codexPatch = path.join(tmp, 'codex-solution.patch');
    fs.writeFileSync(claudePatch, '+++ b/index.html\n+<div class="golden-badge"></div>\n');
    fs.writeFileSync(codexPatch, '+++ b/index.html\n+<dialog id="golden-modal" class="task-hook"></dialog>\n');
    return { baseAppDir, goldenPatchPaths: [claudePatch, codexPatch] };
  }

  it('allows base-app classes, task.md hooks, and platform selectors', (t) => {
    const { baseAppDir, goldenPatchPaths } = setupFixture(t);
    const graderSource = `
      const a = page.locator('.base-card');
      const b = page.locator('.task-hook');
      const c = document.getElementById('main-grid');
      const d = page.getByRole('dialog');
    `;
    const res = checkGraderGoldenSelectorCoupling({
      graderSource,
      baseAppDir,
      taskMd: '- Add a modal with class="task-hook".',
      goldenPatchPaths,
    });
    assert.strictEqual(res, null);
  });

  it('flags golden-only class and id queries across all patches with line numbers', (t) => {
    const { baseAppDir, goldenPatchPaths } = setupFixture(t);
    const graderSource = [
      'const a = page.locator(".golden-badge");',
      'const b = document.getElementById("golden-modal");',
      'const c = el.classList.contains("golden-badge");',
    ].join('\n');
    const res = checkGraderGoldenSelectorCoupling({
      graderSource,
      baseAppDir,
      taskMd: '- Show a badge and modal.',
      goldenPatchPaths,
    });
    assert.ok(res !== null);
    assert.ok(res.includes('Grader appears coupled to non-contract class/id names'));
    assert.ok(res.includes('.golden-badge (L1)'));
    assert.ok(res.includes('#golden-modal (L2)'));
    assert.ok(res.includes('.golden-badge (L3)'));
  });
});
