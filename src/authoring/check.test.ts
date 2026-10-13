import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  checkGraderSource,
  isGen2Grader,
  isGraderFile,
  formatViolations,
} from './check.ts';

describe('Grader Static Checker (src/authoring/check.ts)', () => {
  describe('Path classification helpers', () => {
    it('correctly identifies Gen 1 and Gen 2 graders', () => {
      assert.strictEqual(
        isGen2Grader('guides/built-in-ai/translator/targets/devtools-times/grader.ts'),
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-vacuous-boolean-expect');
      assert.strictEqual(ruleViolations.length, 2);
    });

    it('flags expect(!false) and expect(!true)', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(!false).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      const ruleViolations = violations.filter(v => v.ruleId === 'no-vacuous-boolean-expect');
      assert.strictEqual(ruleViolations.length, 1);
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-vacuous-boolean-expect');
      assert.strictEqual(ruleViolations.length, 0);
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-tautological-expect');
      assert.strictEqual(ruleViolations.length, 1);
    });

    it('flags ternary fallback to true inside expect()', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(hasFeature ? compute() : true).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      const ruleViolations = violations.filter(v => v.ruleId === 'no-tautological-expect');
      assert.strictEqual(ruleViolations.length, 1);
    });

    it('flags ternary returning true in both branches inside expect()', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(hasFeature ? true : true).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      const ruleViolations = violations.filter(v => v.ruleId === 'no-tautological-expect');
      assert.strictEqual(ruleViolations.length, 1);
    });

    it('permits valid boolean conversion cond ? true : false', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('example', () => {
          expect(hasFeature ? true : false).toBe(true);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      const ruleViolations = violations.filter(v => v.ruleId === 'no-tautological-expect');
      assert.strictEqual(ruleViolations.length, 0);
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-test-skip');
      assert.strictEqual(ruleViolations.length, 2);
    });

    it('flags it.skip() and test.describe.skip()', () => {
      const code = `
        import { test, it, expect } from '@playwright/test';
        it.skip('skip it', () => {});
        test.describe.skip('skip describe', () => {});
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      const ruleViolations = violations.filter(v => v.ruleId === 'no-test-skip');
      assert.strictEqual(ruleViolations.length, 2);
    });

    it('permits standard test() calls without skip', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('normal test', () => {
          expect(1).toBe(1);
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      const ruleViolations = violations.filter(v => v.ruleId === 'no-test-skip');
      assert.strictEqual(ruleViolations.length, 0);
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-gen2-file-goto');
      assert.strictEqual(ruleViolations.length, 1);
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-gen2-file-goto');
      assert.strictEqual(ruleViolations.length, 0);
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-gen2-file-goto');
      assert.strictEqual(ruleViolations.length, 0);
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-unguarded-conditional-assertions');
      assert.strictEqual(ruleViolations.length, 1);
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-unguarded-conditional-assertions');
      assert.strictEqual(ruleViolations.length, 1);
    });

    it('permits if statement when else branch throws an error', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('guarded with throw', async ({ page }) => {
          const count = await page.locator('div').count();
          if (count > 0) {
            expect(count).toBe(1);
          } else {
            throw new Error('Elements not found');
          }
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      const ruleViolations = violations.filter(v => v.ruleId === 'no-unguarded-conditional-assertions');
      assert.strictEqual(ruleViolations.length, 0);
    });

    it('permits if statement when else branch contains a real assertion', () => {
      const code = `
        import { test, expect } from '@playwright/test';
        test('guarded both branches', async ({ page }) => {
          const count = await page.locator('div').count();
          if (count > 0) {
            expect(count).toBe(1);
          } else {
            expect(count).toBe(0);
          }
        });
      `;
      const violations = checkGraderSource('guides/category/slug/grader.ts', code);
      const ruleViolations = violations.filter(v => v.ruleId === 'no-unguarded-conditional-assertions');
      assert.strictEqual(ruleViolations.length, 0);
    });

    it('permits if statement when an assertion already exists outside the if statement', () => {
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
      const ruleViolations = violations.filter(v => v.ruleId === 'no-unguarded-conditional-assertions');
      assert.strictEqual(ruleViolations.length, 0);
    });
  });

  describe('formatViolations', () => {
    it('formats violations clearly', () => {
      const sampleMap = new Map([
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
});
