import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAllGraders,
  checkGraderFile,
  checkGraderSource,
  isGen2Grader,
  isGraderFile,
  formatViolations,
  type GraderLintViolation,
} from './grader-lint.ts';

describe('Grader Static Checker (src/core/grader-lint.ts)', () => {
  describe('Path classification helpers', () => {
    it('correctly identifies Gen 1 and Gen 2 graders across relative and nested paths', () => {
      assert.strictEqual(
        isGen2Grader('guides/built-in-ai/translator/targets/devtools-times/grader.ts'),
        true
      );
      assert.strictEqual(
        isGen2Grader('targets/devtools-times/grader.ts'),
        true
      );
      assert.strictEqual(
        isGen2Grader('guides/forms/forms/grader.ts'),
        false
      );
      assert.strictEqual(
        isGraderFile('guides/forms/forms/grader.ts'),
        true
      );
      assert.strictEqual(
        isGraderFile('grader.ts'),
        true
      );
      assert.strictEqual(
        isGraderFile('guides/forms/forms/guide.md'),
        false
      );
    });
  });

  describe('Rule: no-vacuous-boolean-expect', () => {
    it('flags expect(true) and expect(false)', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(true).toBe(true);
          expect(false).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-vacuous-boolean-expect', 'no-vacuous-boolean-expect']
      );
    });

    it('flags expect(!false) and expect(!true)', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(!false).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-vacuous-boolean-expect']
      );
    });

    it('permits dynamic boolean expressions in expect()', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(someValue === true).toBe(true);
          expect(items.length > 0).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });
  });

  describe('Rule: no-tautological-expect', () => {
    it('flags || true inside expect()', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(hasFeature || true).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-tautological-expect']
      );
    });

    it('flags ternary fallback to true inside expect()', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(hasFeature ? compute() : true).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-tautological-expect']
      );
    });

    it('flags ternary returning true in both branches inside expect()', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(hasFeature ? true : true).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-tautological-expect']
      );
    });

    it('permits valid boolean conversion cond ? true : false', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(hasFeature ? true : false).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });
  });

  describe('Rule: no-test-skip', () => {
    it('flags test.skip() at top level and inside test body', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test.skip('skipped test', () => {
          expect(1).toBe(1);
        });
        test('conditionally skipped', () => {
          test.skip();
          expect(2).toBe(2);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-test-skip', 'no-test-skip']
      );
    });

    it('flags it.skip() and test.describe.skip()', () => {
      const code = `
        import { test, it, expect } from '@playwright/test';
        it.skip('skip it', () => {});
        test.describe.skip('skip describe', () => {});
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-test-skip', 'no-test-skip']
      );
    });

    it('permits standard test() calls without skip', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('normal test', () => {
          expect(1).toBe(1);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });
  });

  describe('Rule: no-gen2-file-goto', () => {
    it('flags file:// page.goto in Gen 2 target grader', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('nav', async ({ page }) => {
          await page.goto('file:///path/to/demo.html');
        });
      `;
      const violations = checkGraderSource(
        'guides/category/slug/targets/app/grader.ts',
        code
      );
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-gen2-file-goto']
      );
    });

    it('allows file:// navigation in Gen 1 graders for backward compatibility', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('nav', async ({ page }) => {
          await page.goto('file:///path/to/demo.html');
        });
      `;
      const violations = checkGraderSource(
        'guides/category/slug/grader.ts',
        code
      );
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });

    it('allows http:// localhost navigation in Gen 2 target grader', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('nav', async ({ page }) => {
          await page.goto('http://localhost/demo.html');
        });
      `;
      const violations = checkGraderSource(
        'guides/category/slug/targets/app/grader.ts',
        code
      );
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });
  });

  describe('Rule: no-unguarded-conditional-assertions', () => {
    it('flags if statement with expect() when no assertions exist outside and no else branch exists', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('unguarded', async ({ page }) => {
          const count = await page.locator('div').count();
          if (count > 0) {
            expect(count).toBe(1);
          }
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-unguarded-conditional-assertions']
      );
    });

    it('flags multiple sibling unguarded if statements that have no unconditional assertion', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('two unguarded ifs', async ({ page }) => {
          const a = await page.locator('.a').count();
          const b = await page.locator('.b').count();
          if (a > 0) {
            expect(a).toBe(1);
          }
          if (b > 0) {
            expect(b).toBe(1);
          }
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-unguarded-conditional-assertions', 'no-unguarded-conditional-assertions']
      );
    });

    it('flags else-if chain without a trailing else branch', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('else-if without else', async ({ page }) => {
          const count = await page.locator('div').count();
          if (count === 1) {
            expect(count).toBe(1);
          } else if (count === 2) {
            expect(count).toBe(2);
          }
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-unguarded-conditional-assertions']
      );
    });

    it('flags if statement when else branch is vacuous (expect(true))', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('vacuous else', async ({ page }) => {
          const count = await page.locator('div').count();
          if (count > 0) {
            expect(count).toBe(1);
          } else {
            expect(true).toBe(true);
          }
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(
        violations.map(v => v.ruleId),
        ['no-unguarded-conditional-assertions', 'no-vacuous-boolean-expect']
      );
    });

    it('permits if statement when else branch throws an error (block or braceless)', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('guarded with throw', async ({ page }) => {
          const count = await page.locator('div').count();
          if (count > 0) {
            expect(count).toBe(1);
          } else throw new Error('Elements not found');
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });

    it('permits if / else-if / else chain when all branches assert', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('guarded else-if chain', async ({ page }) => {
          const count = await page.locator('div').count();
          if (count === 1) {
            expect(count).toBe(1);
          } else if (count === 2) {
            expect(count).toBe(2);
          } else {
            expect(count).toBeGreaterThan(2);
          }
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });

    it('permits if statement when an unconditional assertion exists outside the if statement', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('guarded by top-level assertion', async ({ page }) => {
          const count = await page.locator('div').count();
          expect(count).toBeGreaterThan(0);
          if (count === 1) {
            expect(await page.locator('div').textContent()).toBe('hello');
          }
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });
  });

  describe('Rule: invalid-skip-unless', () => {
    it('accepts valid web-features IDs and BCD keys in skipUnless({ unsupported })', () => {
      const code = `
        import { test, expect, skipUnless } from './test-fixture.ts';
        test('fallback check', () => {
          skipUnless({ unsupported: 'switch-control' });
          expect(1).toBe(1);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/targets/daily-grind/grader.ts', code);
      assert.deepStrictEqual(violations.map(v => v.ruleId), []);
    });

    it('flags unknown feature IDs or non-unsupported keys in skipUnless()', () => {
      const code = `
        import { test, expect, skipUnless } from './test-fixture.ts';
        test('bad feature check', () => {
          skipUnless({ unsupported: 'not-a-valid-feature-xyz' });
          skipUnless({ supported: 'switch-control' } as any);
          expect(1).toBe(1);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/targets/daily-grind/grader.ts', code);
      assert.deepStrictEqual(violations.map(v => v.ruleId), ['invalid-skip-unless', 'invalid-skip-unless']);
    });
  });

  describe('formatViolations', () => {
    it('formats violations clearly', () => {
      const sampleMap = new Map<string, GraderLintViolation[]>([
        [
          'guides/test/grader.ts',
          [
            {
              filePath: 'guides/test/grader.ts',
              line: 12,
              column: 5,
              ruleId: 'no-vacuous-boolean-expect',
              message: 'Vacuous boolean assertion',
              snippet: 'expect(true).toBe(true);',
            },
          ],
        ],
      ]);
      const formatted = formatViolations(sampleMap);
      assert.ok(formatted.includes('guides/test/grader.ts'));
      assert.ok(formatted.includes('L12:5'));
      assert.ok(formatted.includes('no-vacuous-boolean-expect'));
    });
  });

  describe('checkGraderFile & checkAllGraders', () => {
    it('lints grader files on disk without TypeScript lib overhead', (t) => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grader-lint-disk-'));
      t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

      const badGrader = path.join(tmpRoot, 'guides', 'css', 'demo', 'targets', 'app', 'grader.ts');
      const goodGrader = path.join(tmpRoot, 'guides', 'css', 'clean', 'grader.ts');
      fs.mkdirSync(path.dirname(badGrader), { recursive: true });
      fs.mkdirSync(path.dirname(goodGrader), { recursive: true });

      fs.writeFileSync(badGrader, `test('bad', async ({ page }) => {\n  await page.goto('file:///tmp/x.html');\n});\n`);
      fs.writeFileSync(goodGrader, `test('good', async ({ page }) => {\n  await expect(page).toHaveTitle(/x/);\n});\n`);

      assert.deepStrictEqual(checkGraderFile(badGrader).map(v => v.ruleId), ['no-gen2-file-goto']);
      assert.deepStrictEqual(checkGraderFile(goodGrader), []);

      const all = checkAllGraders({ repoRoot: tmpRoot });
      assert.deepStrictEqual([...all.keys()], ['guides/css/demo/targets/app/grader.ts']);
    });
  });

  describe('Gen2 vacuity, swallowed-assertion, and fixed-timeout rules', () => {
    const GEN2 = 'guides/category/slug/targets/daily-grind/grader.ts';
    const rules = (code: string, file = GEN2) => checkGraderSource(file, code).map(v => v.ruleId);

    it('only applies the Gen2-specific rules to Gen2 target graders', () => {
      const code = `test('t', async ({ page }) => { await page.waitForTimeout(350); expect(1).toBe(1); });`;
      assert.deepStrictEqual(rules(code, 'guides/category/slug/grader.ts'), []);
      assert.deepStrictEqual(rules(code), ['no-fixed-timeout']);
    });

    describe('no-early-return-before-assertion', () => {
      it('flags early returns ahead of assertions, including mode/flag checks', () => {
        const code = `
          test('dialog closes on Escape', async ({ page }) => {
            const dialog = page.locator('dialog');
            if ((await dialog.count()) === 0) return;
            if (!opener) { return; }
            if (mode === 'skip') return;
            await expect(dialog).not.toBeVisible();
          });`;
        assert.deepStrictEqual(rules(code), [
          'no-early-return-before-assertion',
          'no-early-return-before-assertion',
          'no-early-return-before-assertion',
        ]);
      });

      it('accepts returns that fail first, TypeScript narrowing after non-soft presence assertions, returns in helpers, and page.evaluate callbacks', () => {
        const code = `
          async function openParentChainForTrigger(page, triggerId) {
            await page.evaluate(async (id) => { const btn = document.getElementById(id); if (!btn) return; btn.click(); });
          }
          test('t', async ({ page }) => {
            const files = getTargetFiles();
            if (files.length === 0) { expect(files.length).toBeGreaterThan(0); return; }
            const box = await page.locator('.card').boundingBox();
            expect(box).not.toBeNull();
            if (!box) return;
            expect(box.width).toBeGreaterThan(0);
            const definedBox = await page.locator('.card').boundingBox();
            expect(definedBox).toBeDefined();
            if (definedBox === undefined) return;
            expect(definedBox?.width).toBeGreaterThan(0);
            const ok = await page.evaluate(() => { const orig = document.startViewTransition; if (!orig) return false; return true; });
            expect(ok).toBe(true);
          });`;
        assert.deepStrictEqual(rules(code), []);
      });

      it('still flags early returns after expect.soft or falsy assertions', () => {
        const code = `
          test('t', async ({ page }) => {
            const box = await page.locator('.card').boundingBox();
            expect.soft(box).not.toBeNull();
            if (!box) return;
            expect(box).toBeNull();
            if (!box) return;
            expect(box.width).toBeGreaterThan(0);
          });`;
        assert.deepStrictEqual(rules(code), ['no-early-return-before-assertion', 'no-early-return-before-assertion']);
      });
    });

    describe('no-unguarded-every', () => {
      it('flags .every() over a list with no non-empty guard, after toBeTruthy/toBeDefined, with bare && guards, or when only a sibling property was asserted', () => {
        const code = `
          test('videos are lazy', () => {
            const offscreenVideos = getVideos();
            expect(offscreenVideos).toBeTruthy();
            expect(offscreenVideos).toBeDefined();
            expect(offscreenVideos.every((v) => v.getAttribute('loading') === 'lazy')).toBe(true);
            const allLazy = offscreenVideos.every((v) => v.loading === 'lazy');
            expect(allLazy).toBeTruthy();
            expect(flag && offscreenVideos.every((v) => v.loading === 'lazy')).toBe(true);
            expect(offscreenVideos && offscreenVideos.every((v) => v.loading === 'lazy')).toBe(true);
            const bareGuard = offscreenVideos && offscreenVideos.every((v) => v.loading === 'lazy');
            expect(bareGuard).toBe(true);
            expect(result.extCount).toBeGreaterThan(0);
            expect(result.extStylesheets.every((s) => !s.hasSheet)).toBe(true);
          });`;
        const violations = checkGraderSource(GEN2, code);
        assert.deepStrictEqual(violations.map(v => v.ruleId), [
          'no-unguarded-every',
          'no-unguarded-every',
          'no-unguarded-every',
          'no-unguarded-every',
          'no-unguarded-every',
          'no-unguarded-every',
        ]);
        assert.ok(violations[0].message.includes('.some(bad)'));
      });

      it('accepts a non-empty assertion first (including negated zero checks), a length/size guard in &&, literal lists, and negated .some()', () => {
        const code = `
          test('videos are lazy', () => {
            const offscreenVideos = getVideos();
            const hasLazyOffscreenVideo = offscreenVideos.length > 0 && offscreenVideos.every((v) => v.loading === 'lazy');
            expect(hasLazyOffscreenVideo).toBe(true);
            expect(offscreenVideos.size > 0 && offscreenVideos.every((v) => v.loading === 'lazy')).toBe(true);
            const propSet = getPropSet();
            expect(propSet.size > 0 && Array.from(propSet).every((p) => p.length > 0)).toBe(true);
            const decls = getDecls();
            expect(decls.length).toBeGreaterThan(0);
            expect(decls.every((d) => d.ok)).toBe(true);
            const notEmptyLen = getDecls();
            expect(notEmptyLen).not.toHaveLength(0);
            expect(notEmptyLen.every((d) => d.ok)).toBe(true);
            const notZeroLen = getDecls();
            expect(notZeroLen.length).not.toBe(0);
            expect(notZeroLen.every((d) => d.ok)).toBe(true);
            expect(['a', 'b'].every((s) => s.length === 1)).toBe(true);
            const hasNearZeroOverride = decls.some((d) => /0\\.01ms/.test(d.text));
            expect(hasNearZeroOverride).toBe(false);
          });`;
        assert.deepStrictEqual(rules(code), []);
      });
    });

    describe('no-swallowed-assertion', () => {
      it('flags try/catch and .catch() that swallow an assertion', () => {
        const code = `
          test('t', async ({ page, locator }) => {
            try { await expect(page.locator('dialog')).toBeVisible(); } catch {}
            await expect(page.locator('dialog')).toBeVisible({ timeout: 2000 }).catch(() => {});
            await expect(locator).toBeEnabled({ timeout: 2000 }).catch(() => {});
          });`;
        assert.deepStrictEqual(rules(code), ['no-swallowed-assertion', 'no-swallowed-assertion', 'no-swallowed-assertion']);
      });

      it('accepts catches that rethrow, waitFor* settle catches, or try/catch without assertions', () => {
        const code = `
          test('t', async ({ page }) => {
            await page.waitForLoadState('networkidle').catch(() => {});
            try { await expect(a).toBeVisible(); } catch (e) { throw new Error('dialog never opened'); }
            try { JSON.parse(raw); } catch {}
          });`;
        assert.deepStrictEqual(rules(code), []);
      });
    });

    describe('no-fixed-timeout', () => {
      it('flags waitForTimeout and awaited setTimeout sleeps', () => {
        const code = `
          test('t', async ({ page }) => {
            await page.waitForTimeout(350);
            await new Promise((r) => setTimeout(r, 30));
            const settle = () => new Promise((r) => setTimeout(() => r(), 50));
            expect(1).toBe(1);
          });`;
        assert.deepStrictEqual(rules(code), ['no-fixed-timeout', 'no-fixed-timeout', 'no-fixed-timeout']);
      });

      it('accepts expectNever, setTimeout as a Promise.race cap, and fallback timers', () => {
        const code = `
          test('t', async ({ page }) => {
            await expectNever(page, () => window.__bad, { forMs: 400 });
            await Promise.race([finished.catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
            await new Promise((resolve) => { const timer = setTimeout(finish, 1000); el.addEventListener('done', () => { clearTimeout(timer); resolve(); }); });
          });`;
        assert.deepStrictEqual(rules(code), []);
      });
    });
  });
});
