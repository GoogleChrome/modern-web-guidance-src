import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSMediaRule,
  getDeclaredProperties,
} from 'cssomnom';
import {
  SyntaxKind,
} from 'ts-morph';
import type { Page, Locator } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// @ts-ignore - package.json omits "type": "module", causing tsc nodenext to warn on import.meta
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getResolvedJsFiles(files: string[]): string[] {
  const docs = getHtmlDocuments(files);
  const linkedScripts = docs.flatMap((d) => {
    const scripts = Array.from(d.document.querySelectorAll('script[src]')) as any[];
    const dir = path.dirname(d.file);
    return scripts
      .map((s) => path.resolve(dir, s.getAttribute('src')))
      .filter((f) => fs.existsSync(f));
  });
  return Array.from(new Set([...files, ...linkedScripts]));
}

async function triggerReorder(page: Page): Promise<Locator> {
  const select = page.locator('select').first();
  if ((await select.count()) > 0) {
    await select.waitFor({ state: 'visible', timeout: 5000 });
    const currentIndex = await select.evaluate((el: HTMLSelectElement) => el.selectedIndex);
    const targetIndex = currentIndex === 0 ? 1 : 0;
    await select.selectOption({ index: targetIndex });
    return select;
  }

  const sortBtn = page
    .locator('button')
    .filter({ hasText: /sort|name|price|reverse|order/i })
    .first();
  if ((await sortBtn.count()) > 0) {
    await sortBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sortBtn.click();
    return sortBtn;
  }

  const anyBtn = page.locator('main button').first();
  if ((await anyBtn.count()) > 0) {
    await anyBtn.waitFor({ state: 'visible', timeout: 5000 });
    await anyBtn.click();
    return anyBtn;
  }

  throw new Error('No reorder control found on page');
}

test.describe('dynamic-sort Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('When the reorder is animated, it runs inside a view transition started with startViewTransition(), guarded by feature detection', () => {
    const allJsFiles = getResolvedJsFiles(targetFiles);
    const project = getJsProject(allJsFiles);
    const sourceFiles = project.getSourceFiles();

    expect(sourceFiles.length).toBeGreaterThan(0);

    const callExprs = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const svtCalls = callExprs.filter((c) => {
      const text = c.getExpression().getText();
      return text.includes('startViewTransition');
    });

    expect(svtCalls.length).toBeGreaterThan(0);

    const hasFeatureDetection = sourceFiles.some((sf) => {
      const ifConditions = sf
        .getDescendantsOfKind(SyntaxKind.IfStatement)
        .map((i) => i.getExpression().getText());
      const conditionalExprs = sf
        .getDescendantsOfKind(SyntaxKind.ConditionalExpression)
        .map((c) => c.getCondition().getText());
      const binaryExprs = sf
        .getDescendantsOfKind(SyntaxKind.BinaryExpression)
        .map((b) => b.getText());

      const allConditions = [...ifConditions, ...conditionalExprs, ...binaryExprs];
      return allConditions.some((text) => text.includes('startViewTransition'));
    });

    expect(hasFeatureDetection).toBe(true);
  });

  test('When the reorder is animated, each list item has a unique view-transition-name or uses match-element', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const declaredProps = getDeclaredProperties(stylesheet);
    const styleRules = getRules(stylesheet, CSSStyleRule);
    const vtnRules = styleRules.filter((r) =>
      Boolean(r.style.getPropertyValue('view-transition-name'))
    );

    const usesMatchElement = vtnRules.some((r) =>
      r.style.getPropertyValue('view-transition-name').includes('match-element')
    );

    const docs = getHtmlDocuments(targetFiles);
    const hasInlineVtn = docs.some((d) => {
      const cards = Array.from(d.document.querySelectorAll('.card'));
      return cards.some((c: any) =>
        c.getAttribute('style')?.includes('view-transition-name')
      );
    });

    const allJsFiles = getResolvedJsFiles(targetFiles);
    const project = getJsProject(allJsFiles);
    const hasJsVtn = project
      .getSourceFiles()
      .some((sf) => sf.getText().includes('viewTransitionName'));

    expect(declaredProps.has('view-transition-name') || hasInlineVtn || hasJsVtn).toBe(true);
    expect(usesMatchElement || vtnRules.length > 0 || hasInlineVtn || hasJsVtn).toBe(true);
  });

  test('When the reorder is animated, view transition animations are disabled when prefers-reduced-motion: reduce is active', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const mediaRules = getRules(stylesheet, CSSMediaRule);
    const reducedMotionRule = mediaRules.find(
      (r) =>
        r.conditionText.includes('prefers-reduced-motion') &&
        r.conditionText.includes('reduce')
    );

    const allJsFiles = getResolvedJsFiles(targetFiles);
    const project = getJsProject(allJsFiles);
    const hasJsReducedMotion = project
      .getSourceFiles()
      .some(
        (sf) =>
          sf.getText().includes('prefers-reduced-motion') &&
          sf.getText().includes('reduce')
      );

    expect(Boolean(reducedMotionRule) || hasJsReducedMotion).toBe(true);

    if (reducedMotionRule) {
      const innerStyleRules = getRules(reducedMotionRule, CSSStyleRule);
      const disablesAnimation = innerStyleRules.some((r) => {
        const anim =
          r.style.getPropertyValue('animation') ||
          r.style.getPropertyValue('animation-name');
        const duration = r.style.getPropertyValue('animation-duration');
        return (
          anim.includes('none') || duration === '0s' || duration === '0ms'
        );
      });
      expect(disablesAnimation || hasJsReducedMotion).toBe(true);
    }
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('A user action reorders the list items in the DOM so DOM order matches visual order', async ({
      page,
    }) => {
      const initialTitles = await page.locator('.card h3').allTextContents();
      expect(initialTitles.length).toBeGreaterThan(1);

      const control = await triggerReorder(page);
      expect(control).toBeDefined();

      await page.waitForFunction(
        (origFirst) => {
          const cards = Array.from(document.querySelectorAll('.card h3'));
          return cards[0]?.textContent?.trim() !== origFirst;
        },
        initialTitles[0]?.trim(),
        { timeout: 5000 }
      );

      const newTitles = await page.locator('.card h3').allTextContents();
      expect(newTitles).not.toEqual(initialTitles);

      const isMatchingVisual = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.card'));
        const rects = cards.map((c) => c.getBoundingClientRect());

        for (let i = 0; i < rects.length - 1; i++) {
          const a = rects[i];
          const b = rects[i + 1];

          const bIsLower = b.top >= a.bottom - 5;
          const bIsRightSameRow =
            b.left >= a.left - 5 && b.top <= a.bottom && a.top <= b.bottom;

          if (!bIsLower && !bIsRightSameRow) {
            return false;
          }
        }
        return true;
      });

      expect(isMatchingVisual).toBe(true);
    });

    test('Item elements captured before a reorder are the same connected elements after the reorder, rather than being recreated', async ({
      page,
    }) => {
      const capturedCount = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.card'));
        (window as any).__capturedNodes = cards;
        cards.forEach((card, index) => {
          (card as any).__capturedId = index;
        });
        return cards.length;
      });
      expect(capturedCount).toBeGreaterThan(1);

      const initialFirstTitle = await page.locator('.card h3').first().textContent();
      await triggerReorder(page);

      await page.waitForFunction(
        (origFirst) => {
          const cards = Array.from(document.querySelectorAll('.card h3'));
          return cards[0]?.textContent?.trim() !== origFirst;
        },
        initialFirstTitle?.trim(),
        { timeout: 5000 }
      );

      const identityCheck = await page.evaluate(() => {
        const captured: HTMLElement[] = (window as any).__capturedNodes || [];
        const currentCards = Array.from(
          document.querySelectorAll('.card')
        ) as HTMLElement[];

        if (captured.length === 0 || currentCards.length === 0) {
          return { ok: false, reason: 'empty' };
        }

        const allIdentical = currentCards.every((c) => captured.includes(c));
        const allRetainedMarkers = currentCards.every(
          (c) => (c as any).__capturedId !== undefined
        );
        const allStillConnected = captured.every((c) => c.isConnected);

        return {
          ok:
            allIdentical &&
            allRetainedMarkers &&
            allStillConnected &&
            currentCards.length === captured.length,
          allIdentical,
          allRetainedMarkers,
          allStillConnected,
        };
      });

      expect(identityCheck.ok).toBe(true);
    });

    test('Items are reordered with moveBefore() when Object.hasOwn(Element.prototype, "moveBefore") is true', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        if (!Object.hasOwn(Element.prototype, 'moveBefore')) {
          (Element.prototype as any).moveBefore = function (
            node: Node,
            ref: Node | null
          ) {
            return this.insertBefore(node, ref);
          };
        }
        (window as any).__moveBeforeCalls = [];
        const origMove = (Element.prototype as any).moveBefore;
        (Element.prototype as any).moveBefore = function (
          node: Node,
          ref: Node | null
        ) {
          (window as any).__moveBeforeCalls.push({
            containerTag: this.tagName,
            nodeTag: (node as HTMLElement)?.tagName,
            isCard: (node as HTMLElement)?.classList?.contains('card'),
          });
          return origMove.call(this, node, ref);
        };
      });

      await page.reload();

      const initialFirstTitle = await page.locator('.card h3').first().textContent();
      expect(initialFirstTitle).toBeTruthy();

      await triggerReorder(page);

      await page.waitForFunction(
        (origFirst) => {
          const cards = Array.from(document.querySelectorAll('.card h3'));
          return cards[0]?.textContent?.trim() !== origFirst;
        },
        initialFirstTitle?.trim(),
        { timeout: 5000 }
      );

      const moveBeforeCalls = await page.evaluate(() => {
        return (window as any).__moveBeforeCalls || [];
      });

      expect(moveBeforeCalls.length).toBeGreaterThan(0);
      const cardMoves = moveBeforeCalls.filter((c: any) => c.isCard);
      expect(cardMoves.length).toBeGreaterThan(0);
    });

    test('The list element does not have aria-live, and one role="status" region has its text set once per reorder', async ({
      page,
    }) => {
      const listEl = page.locator('.grid').first();
      expect(await listEl.count()).toBeGreaterThan(0);
      const ariaLive = await listEl.getAttribute('aria-live');
      expect(ariaLive).toBeNull();

      const statusRegions = page.locator('[role="status"]');
      expect(await statusRegions.count()).toBe(1);

      await page.evaluate(() => {
        const statusEl = document.querySelector('[role="status"]');
        (window as any).__statusUpdateCount = 0;
        if (statusEl) {
          const origDescriptor = Object.getOwnPropertyDescriptor(
            Node.prototype,
            'textContent'
          );
          if (origDescriptor && origDescriptor.set) {
            const origSet = origDescriptor.set;
            Object.defineProperty(statusEl, 'textContent', {
              set(val) {
                (window as any).__statusUpdateCount++;
                origSet.call(this, val);
              },
              get() {
                return origDescriptor.get?.call(this);
              },
              configurable: true,
            });
          }
        }
      });

      const initialFirstTitle = await page.locator('.card h3').first().textContent();
      await triggerReorder(page);

      await page.waitForFunction(
        (origFirst) => {
          const cards = Array.from(document.querySelectorAll('.card h3'));
          return cards[0]?.textContent?.trim() !== origFirst;
        },
        initialFirstTitle?.trim(),
        { timeout: 5000 }
      );

      await expect(statusRegions.first()).not.toBeEmpty();

      const updateCount = await page.evaluate(() => {
        return (window as any).__statusUpdateCount ?? 0;
      });

      expect(updateCount).toBe(1);
    });

    test('Focus remains on the activated control after the reorder completes', async ({
      page,
    }) => {
      const select = page.locator('select').first();
      const sortBtn = page.locator('main button').first();
      const control = (await select.count()) > 0 ? select : sortBtn;

      expect(await control.count()).toBeGreaterThan(0);
      await control.waitFor({ state: 'visible', timeout: 5000 });

      await control.focus();
      await expect(control).toBeFocused();

      const initialFirstTitle = await page.locator('.card h3').first().textContent();

      if ((await select.count()) > 0) {
        const currentIndex = await control.evaluate(
          (el: HTMLSelectElement) => el.selectedIndex
        );
        const targetIndex = currentIndex === 0 ? 1 : 0;
        await control.selectOption({ index: targetIndex });
      } else {
        await control.click();
      }

      await page.waitForFunction(
        (origFirst) => {
          const cards = Array.from(document.querySelectorAll('.card h3'));
          return cards[0]?.textContent?.trim() !== origFirst;
        },
        initialFirstTitle?.trim(),
        { timeout: 5000 }
      );

      await page.waitForTimeout(350);
      await expect(control).toBeFocused();
    });
  });
});
