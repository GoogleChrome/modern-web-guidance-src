import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  extractTaskHooks,
  extractGoldenOnlyClasses,
  buildProbeRenameMap,
  renameClassesInContent,
  runSelectorGatingProbe,
} from './selector-probe.ts';

describe('extractTaskHooks', () => {
  it('extracts id, class, and data-* hooks from task.md', () => {
    const hooks = extractTaskHooks(
      '- Add a passkey section with id="passkey-list", class="key-row primary", data-passkey-id, and `#status-banner` or `.legacy-hook`.'
    );
    assert.ok(hooks.has('passkey-list'));
    assert.ok(hooks.has('key-row'));
    assert.ok(hooks.has('primary'));
    assert.ok(hooks.has('data-passkey-id'));
    assert.ok(hooks.has('status-banner'));
    assert.ok(hooks.has('legacy-hook'));
  });
});

describe('extractGoldenOnlyClasses', () => {
  it('extracts custom CSS and selector-queried classes while ignoring base-app classes, task hooks, and Tailwind utilities', () => {
    const goldenOnly = extractGoldenOnlyClasses({
      goldenFiles: [
        {
          filePath: 'src/components/Teaser.astro',
          content: `---
const active = true;
---
<div class="card teaser-wrap bg-white p-6 md:p-8" data-hook="true">
  <span class="badge-new task-badge">New</span>
</div>
<style>
  @container (min-width: 300px) {
    .card.teaser-wrap:has(.badge-new) { display: grid; }
  }
  .task-badge { font-weight: 700; }
</style>
<script>
  document.querySelectorAll('.js-item');
  document.body.classList.toggle('hidden');
</script>`,
        },
      ],
      baseAppClasses: new Set(['card', 'hidden']),
      taskHooks: new Set(['task-badge']),
    });

    assert.deepStrictEqual(goldenOnly, ['badge-new', 'js-item', 'teaser-wrap']);
  });
});

describe('renameClassesInContent', () => {
  const renameMap = buildProbeRenameMap(['foo-bar', 'foo', 'is-open']);
  // Sorted: foo -> mwg-probe-0, foo-bar -> mwg-probe-1, is-open -> mwg-probe-2

  it('builds deterministic sorted probe names', () => {
    assert.deepStrictEqual(
      [...renameMap.entries()],
      [
        ['foo', 'mwg-probe-0'],
        ['foo-bar', 'mwg-probe-1'],
        ['is-open', 'mwg-probe-2'],
      ]
    );
  });

  it('safely renames CSS selectors without mangling comments, urls, strings, or prefix-sharing classes', () => {
    const input = `/* keep .foo-bar in comment */
.foo.foo-bar:has(.is-open) {
  background: url(foo.png);
  content: ".foo-bar";
}
[class~="foo-bar"] { color: red; }`;
    const actual = renameClassesInContent('styles.css', input, renameMap);
    assert.strictEqual(
      actual,
      `/* keep .foo-bar in comment */
.mwg-probe-0.mwg-probe-1:has(.mwg-probe-2) {
  background: url(foo.png);
  content: ".foo-bar";
}
[class~="mwg-probe-1"] { color: red; }`
    );
  });

  it('safely renames HTML, Astro, and JSX class attributes without altering inner text or interpolations', () => {
    const astroInput = `---
const el = document.querySelector('.foo-bar');
---
<div class="base foo foo-bar" class:list={[\`item \${flag ? 'is-open' : ''}\`, { 'foo-bar': true }]}>
  foo-bar stays visible text
</div>
<style>
  .foo-bar.is-open { opacity: 1; }
</style>
<script>
  el?.classList.add('is-open');
  document.getElementsByClassName('foo foo-bar');
</script>`;
    const actual = renameClassesInContent('Card.astro', astroInput, renameMap);
    assert.strictEqual(
      actual,
      `---
const el = document.querySelector('.mwg-probe-1');
---
<div class="base mwg-probe-0 mwg-probe-1" class:list={[\`item \${flag ? 'mwg-probe-2' : ''}\`, { 'mwg-probe-1': true }]}>
  foo-bar stays visible text
</div>
<style>
  .mwg-probe-1.mwg-probe-2 { opacity: 1; }
</style>
<script>
  el?.classList.add('mwg-probe-2');
  document.getElementsByClassName('mwg-probe-0 mwg-probe-1');
</script>`
    );
  });

  it('safely renames JS selector queries, classList calls, setAttribute, className, and TSX className', () => {
    const tsxInput = `export function Widget({ open }: { open: boolean }) {
  const node = document.querySelector('.foo-bar > .foo');
  node?.closest('.is-open');
  node?.classList.toggle('is-open', open);
  node?.setAttribute('class', 'foo foo-bar');
  if (node) node.className = 'foo-bar';
  const label = 'foo-bar';
  return <section className={open ? 'foo-bar is-open' : 'foo'}>{label}</section>;
}`;
    const actual = renameClassesInContent('Widget.tsx', tsxInput, renameMap);
    assert.strictEqual(
      actual,
      `export function Widget({ open }: { open: boolean }) {
  const node = document.querySelector('.mwg-probe-1 > .mwg-probe-0');
  node?.closest('.mwg-probe-2');
  node?.classList.toggle('mwg-probe-2', open);
  node?.setAttribute('class', 'mwg-probe-0 mwg-probe-1');
  if (node) node.className = 'mwg-probe-1';
  const label = 'foo-bar';
  return <section className={open ? 'mwg-probe-1 mwg-probe-2' : 'mwg-probe-0'}>{label}</section>;
}`
    );
  });
});

describe('runSelectorGatingProbe', () => {
  function setupGuideWithPatch(t: import('node:test').TestContext, patchText: string, taskText = '- Update the menu cards.\n') {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'selector-probe-test-'));
    t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));
    const targetDir = path.join(tmpRoot, 'targets', 'daily-grind');
    fs.mkdirSync(path.join(targetDir, 'patches'), { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'task.md'), taskText);
    const patchFile = path.join(targetDir, 'patches', 'claude-solution.patch');
    fs.writeFileSync(patchFile, patchText);
    const graderPath = path.join(targetDir, 'grader.ts');
    fs.writeFileSync(graderPath, '// grader\n');
    return { guideDirAbs: tmpRoot, patchFile, graderPath };
  }

  const sampleDailyGrindPatch = `diff --git a/index.html b/index.html
index 66c9173..1111111 100644
--- a/index.html
+++ b/index.html
@@ -12,6 +12,9 @@
       --accent: #ffab40;
       --text: #3e2723;
       --light: #fafafa;
     }
+    .golden-card-badge {
+      color: red;
+    }
 
     * {
`;

  it('passes when no golden-only custom classes are introduced (or all tests still pass)', async (t) => {
    const noNewClassPatch = `diff --git a/index.html b/index.html
index 66c9173..1111111 100644
--- a/index.html
+++ b/index.html
@@ -12,6 +12,7 @@
       --accent: #ffab40;
       --text: #3e2723;
       --light: #fafafa;
+      /* .card already exists in base app */
     }
 
     * {
`;
    const { guideDirAbs, patchFile, graderPath } = setupGuideWithPatch(t, noNewClassPatch);
    let invoked = false;
    const res = await runSelectorGatingProbe({
      guideDirAbs,
      baseApp: 'daily-grind',
      patchFile,
      graderPath,
      runPlaywrightFn: async () => {
        invoked = true;
        return { stats: { expected: 1, unexpected: 0 }, suites: [] };
      },
    });
    assert.strictEqual(res.passed, true);
    assert.strictEqual(res.renamedClasses.size, 0);
    assert.strictEqual(invoked, false);

    // Now test with golden-only class where grader still passes
    const { guideDirAbs: g2, patchFile: p2, graderPath: gr2 } = setupGuideWithPatch(t, sampleDailyGrindPatch);
    let seenPatchContent = '';
    const res2 = await runSelectorGatingProbe({
      guideDirAbs: g2,
      baseApp: 'daily-grind',
      patchFile: p2,
      graderPath: gr2,
      runPlaywrightFn: async (_target, _grader, opts) => {
        seenPatchContent = opts.patchFile ? fs.readFileSync(opts.patchFile, 'utf8') : '';
        return {
          stats: { expected: 1, unexpected: 0 },
          suites: [{ title: 'Grader', specs: [{ title: 'Check badge color', ok: true }] }],
        };
      },
    });
    assert.strictEqual(res2.passed, true);
    assert.deepStrictEqual([...res2.renamedClasses.entries()], [['golden-card-badge', 'mwg-probe-0']]);
    assert.ok(seenPatchContent.includes('.mwg-probe-0'));
    assert.ok(!seenPatchContent.includes('.golden-card-badge'));
  });

  it('fails with crisp diagnostic naming failing tests and renamed classes when grader breaks after rename', async (t) => {
    const { guideDirAbs, patchFile, graderPath } = setupGuideWithPatch(t, sampleDailyGrindPatch);
    const res = await runSelectorGatingProbe({
      guideDirAbs,
      baseApp: 'daily-grind',
      patchFile,
      graderPath,
      originalPassingTests: ['Check badge color'],
      runPlaywrightFn: async () => ({
        stats: { expected: 0, unexpected: 1 },
        suites: [
          {
            title: 'Grader',
            specs: [{ title: 'Check badge color', ok: false }],
          },
        ],
      }),
    });

    assert.strictEqual(res.passed, false);
    assert.deepStrictEqual(res.failingTests, ['Check badge color']);
    assert.ok(res.diagnostic?.includes('Grader appears coupled to non-contract class names'));
    assert.ok(res.diagnostic?.includes('Check badge color'));
    assert.ok(res.diagnostic?.includes('golden-card-badge -> mwg-probe-0'));
  });
});
