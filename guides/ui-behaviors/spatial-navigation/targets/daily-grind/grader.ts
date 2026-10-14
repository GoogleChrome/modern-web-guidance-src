import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = typeof process.env.PATCH_FILE === 'string'
  // @ts-ignore
  ? getTargetFiles(import.meta.url)
  : [];

test.describe('Spatial Navigation Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('Spatial navigation implementation queries live visual bounding client geometries (ts-morph)', () => {
    const project = getJsProject(targetFiles);
    const hasBoundingClientRect = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some(call =>
        call.getExpression().getText().endsWith('getBoundingClientRect')
      )
    );
    expect(hasBoundingClientRect).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.setViewportSize({ width: 700, height: 800 });
      await page.goto(TARGET_URL);
    });

    test('Spatial navigation container exposes exactly one sequential tab stop', async ({ page }) => {
      const tabStopsCount = await page.evaluate(() => {
        const container = document.querySelector('.grid');
        if (!container) return 0;
        const interactive = Array.from(container.querySelectorAll('a[href], button:not([disabled]), [tabindex]'));
        return interactive.filter(el => (el as HTMLElement).tabIndex >= 0).length;
      });
      expect(tabStopsCount).toBe(1);
    });

    test('Pressing Right Arrow moves focus to the visually closest focusable element to the right', async ({ page }) => {
      await page.locator('.grid .card a').first().focus();
      await page.keyboard.press('ArrowRight');
      const activeHref = await page.evaluate(() => document.activeElement?.getAttribute('href'));
      expect(activeHref).toBe('/menu/espresso');
    });

    test('Pressing Left Arrow moves focus to the visually closest focusable element to the left', async ({ page }) => {
      await page.locator('.grid .card a').nth(1).focus();
      await page.keyboard.press('ArrowLeft');
      const activeHref = await page.evaluate(() => document.activeElement?.getAttribute('href'));
      expect(activeHref).toBe('/menu/seasonal');
    });

    test('Pressing Down Arrow moves focus to the visually closest focusable element below', async ({ page }) => {
      await page.locator('.grid .card a').first().focus();
      await page.keyboard.press('ArrowDown');
      const activeHref = await page.evaluate(() => document.activeElement?.getAttribute('href'));
      expect(activeHref).toBe('/menu/cold-brew');
    });

    test('Pressing Up Arrow moves focus to the visually closest focusable element above', async ({ page }) => {
      await page.locator('.grid .card a').nth(2).focus();
      await page.keyboard.press('ArrowUp');
      const activeHref = await page.evaluate(() => document.activeElement?.getAttribute('href'));
      expect(activeHref).toBe('/menu/seasonal');
    });

    test('Pressing an arrow key where no candidate exists preserves default viewport scroll behavior', async ({ page }) => {
      const result = await page.evaluate(() => {
        const first = document.querySelector('.grid .card a') as HTMLElement | null;
        if (!first) return { validPrevented: false, boundaryPrevented: true };

        // 1. Valid navigation direction: spatial navigation must intercept and prevent default
        first.focus();
        const validEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        first.dispatchEvent(validEvent);

        // 2. Boundary direction (no candidate left of first element): must NOT prevent default
        first.focus();
        const boundaryEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
        first.dispatchEvent(boundaryEvent);

        return {
          validPrevented: validEvent.defaultPrevented,
          boundaryPrevented: boundaryEvent.defaultPrevented,
        };
      });

      expect(result.validPrevented && !result.boundaryPrevented).toBe(true);
    });

    test('Focused element inside spatial widget is scrolled into view', async ({ page }) => {
      const isScrolledIntoView = await page.evaluate(() => {
        let scrollIntoViewCalled = false;
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (...args) {
          scrollIntoViewCalled = true;
          return originalScrollIntoView.apply(this, args);
        };

        try {
          const first = document.querySelector('.grid .card a') as HTMLElement | null;
          if (!first) return false;
          first.focus();

          scrollIntoViewCalled = false;

          const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
          first.dispatchEvent(event);

          return scrollIntoViewCalled;
        } finally {
          Element.prototype.scrollIntoView = originalScrollIntoView;
        }
      });

      expect(isScrolledIntoView).toBe(true);
    });

    test('Active focused state updates roving tabindex and maintains programmatic focus across navigation', async ({ page }) => {
      await page.locator('.grid .card a').first().focus();
      await page.keyboard.press('ArrowRight');

      const state = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.grid .card a')) as HTMLElement[];
        if (items.length < 2) return { focusMaintained: false, rovingUpdated: false };
        const [first, second] = items;
        const isSecondFocused = document.activeElement === second;
        const isRovingUpdated = second.tabIndex === 0 && first.tabIndex === -1;
        return {
          focusMaintained: isSecondFocused,
          rovingUpdated: isRovingUpdated,
        };
      });

      expect(state.focusMaintained && state.rovingUpdated).toBe(true);
    });
  });
});
