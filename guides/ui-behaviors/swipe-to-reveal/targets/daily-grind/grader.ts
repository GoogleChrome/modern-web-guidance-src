import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule } from 'cssomnom';
import { SyntaxKind, type Project } from 'ts-morph';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('swipe-to-reveal Target Grader', () => {
  test('Horizontal swipe-to-reveal container is a horizontal scroll container configured with mandatory CSS Scroll Snap and no manual JS gesture listeners', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);
    const docs = getHtmlDocuments(targetFiles);

    const hasOverflowX =
      styleRules.some((r) => {
        const ox = r.style.getPropertyValue('overflow-x').trim();
        const oInline = r.style.getPropertyValue('overflow-inline').trim();
        const o = r.style.getPropertyValue('overflow').trim();
        return (
          /\b(auto|scroll)\b/.test(ox) ||
          /\b(auto|scroll)\b/.test(oInline) ||
          /\b(auto|scroll)\b/.test(o)
        );
      }) ||
      docs.some((d) =>
        Boolean(d.document.querySelector('[class*="overflow-x-auto"], [class*="overflow-x-scroll"]')),
      );

    const hasMandatorySnap =
      styleRules.some((r) => {
        const snapType = r.style.getPropertyValue('scroll-snap-type').trim();
        return /\b(x|inline|both)\s+mandatory\b/.test(snapType);
      }) ||
      docs.some((d) =>
        Boolean(
          d.document.querySelector(
            '[class*="snap-x"][class*="snap-mandatory"], [class*="snap-inline"][class*="snap-mandatory"]',
          ),
        ),
      );

    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasManualGestureListener = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'addEventListener'
      ) {
        const firstArg = call.getArguments()[0];
        if (firstArg) {
          const text = firstArg.getText().replace(/^['"`]|['"`]$/g, '');
          return /^(wheel|touchmove|pointermove)$/.test(text);
        }
      }
      return false;
    });

    expect(hasOverflowX && hasMandatorySnap && !hasManualGestureListener).toBe(true);
  });

  test('Foreground content element sets scroll-snap-align: start, scroll-initial-target: nearest, and an opaque background, while trailing panels snap to end', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);
    const docs = getHtmlDocuments(targetFiles);

    const hasContentSnapAndInitialTarget = styleRules.some((r) => {
      const snapAlign = r.style.getPropertyValue('scroll-snap-align').trim();
      const initialTarget = r.style.getPropertyValue('scroll-initial-target').trim();
      const bg =
        r.style.getPropertyValue('background').trim() ||
        r.style.getPropertyValue('background-color').trim();
      const hasOpaqueBg = Boolean(bg) && bg !== 'transparent' && bg !== 'none';
      return /\bstart\b/.test(snapAlign) && /\bnearest\b/.test(initialTarget) && hasOpaqueBg;
    });

    const hasPanelSnapEnd =
      styleRules.some((r) => {
        const snapAlign = r.style.getPropertyValue('scroll-snap-align').trim();
        return /\bend\b/.test(snapAlign);
      }) || docs.some((d) => Boolean(d.document.querySelector('[class*="snap-end"]')));

    expect(hasContentSnapAndInitialTarget && hasPanelSnapEnd).toBe(true);
  });

  test('Outer horizontal swipe-to-reveal container sets overscroll-behavior: chain in CSS without contain or none', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);

    const hasChainOverscroll = styleRules.some((r) => {
      const ob = r.style.getPropertyValue('overscroll-behavior').trim();
      const obX = r.style.getPropertyValue('overscroll-behavior-x').trim();
      const obInline = r.style.getPropertyValue('overscroll-behavior-inline').trim();
      const usesChain = /\bchain\b/.test(ob) || /\bchain\b/.test(obX) || /\bchain\b/.test(obInline);
      const usesContainOrNone =
        /\b(contain|none)\b/.test(ob) ||
        /\b(contain|none)\b/.test(obX) ||
        /\b(contain|none)\b/.test(obInline);
      return usesChain && !usesContainOrNone;
    });

    expect(hasChainOverscroll).toBe(true);
  });

  test('Revealed action controls or side-menu items are focusable DOM elements inside the swipe-to-reveal container', () => {
    const docs = getHtmlDocuments(targetFiles);

    const hasSwipeStructureWithFocusableActions = docs.some(({ document }) => {
      const candidates = Array.from(document.querySelectorAll('div, li, article, section')) as any[];
      return candidates.some((container) => {
        const children = Array.from(container.children || []) as any[];
        if (children.length < 2) return false;
        const contentEl = children[0];
        const panelEl = children[children.length - 1];
        const hasCardHeading = Boolean(contentEl.querySelector('h2, h3, h4, strong'));
        const panelControls = Array.from(
          panelEl.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'),
        );
        return hasCardHeading && panelControls.length >= 2;
      });
    });

    expect(hasSwipeStructureWithFocusableActions).toBe(true);
  });

  test('Keyboard focus (focusin paired with :focus-visible) scrolls the foreground content element back to inline start', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasFocusinListener = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'addEventListener'
      ) {
        const firstArg = call.getArguments()[0];
        return Boolean(firstArg && /^['"`]focusin['"`]$/.test(firstArg.getText()));
      }
      return false;
    });

    const hasFocusVisibleMatch = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'matches'
      ) {
        const firstArg = call.getArguments()[0];
        return Boolean(firstArg && firstArg.getText().includes(':focus-visible'));
      }
      return false;
    });

    const hasScrollIntoViewInlineStart = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'scrollIntoView'
      ) {
        const firstArg = call.getArguments()[0];
        if (firstArg && firstArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const obj = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
          const blockProp = obj.getProperty('block');
          const inlineProp = obj.getProperty('inline');
          const hasNearest = Boolean(blockProp && blockProp.getText().includes('nearest'));
          const hasStart = Boolean(inlineProp && inlineProp.getText().includes('start'));
          return hasNearest && hasStart;
        }
      }
      return false;
    });

    expect(hasFocusinListener && hasFocusVisibleMatch && hasScrollIntoViewInlineStart).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Each swipe to reveal interaction has an associated trigger <button> for revealing the content', async ({
      page,
    }) => {
      const triggers = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll<HTMLElement>('.SwipeReveal, .grid > *')).filter((el) => {
          const cs = window.getComputedStyle(el);
          return (
            el.classList.contains('SwipeReveal') ||
            cs.overflowX === 'auto' ||
            cs.overflowX === 'scroll' ||
            cs.scrollSnapType.includes('mandatory')
          );
        });
        return containers.map((c) => {
          const content = c.querySelector('.SwipeReveal-content') ?? c.firstElementChild;
          const btn = content?.querySelector('button') ?? null;
          return Boolean(btn);
        });
      });

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.every(Boolean)).toBe(true);
    });

    test('Activating the associated trigger button performs the same action as the swipe it stands in for', async ({
      page,
    }) => {
      const setup = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll<HTMLElement>('.SwipeReveal, .grid > *')).filter((el) => {
          const cs = window.getComputedStyle(el);
          return (
            el.classList.contains('SwipeReveal') ||
            cs.overflowX === 'auto' ||
            cs.overflowX === 'scroll' ||
            cs.scrollSnapType.includes('mandatory')
          );
        });
        const first = containers[0];
        if (!first) return { count: 0, beforeScrollLeft: -1 };
        first.setAttribute('data-grader-swipe-target', '0');
        const content = first.querySelector('.SwipeReveal-content') ?? first.firstElementChild;
        const btn = content?.querySelector('button');
        if (btn) btn.setAttribute('data-grader-swipe-trigger', '0');
        return { count: containers.length, beforeScrollLeft: first.scrollLeft };
      });
      expect(setup.count).toBeGreaterThan(0);

      const firstTrigger = page.locator('[data-grader-swipe-trigger="0"]').first();
      await expect(firstTrigger).toBeVisible();

      await firstTrigger.click();

      await expect
        .poll(() =>
          page.evaluate(() => {
            const c = document.querySelector<HTMLElement>('[data-grader-swipe-target="0"]');
            return c ? c.scrollLeft : 0;
          }),
        )
        .not.toBe(setup.beforeScrollLeft);
    });

    test("Each trigger button has an accessible name that includes the associated content's text", async ({
      page,
    }) => {
      const checks = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll<HTMLElement>('.SwipeReveal, .grid > *')).filter((el) => {
          const cs = window.getComputedStyle(el);
          return (
            el.classList.contains('SwipeReveal') ||
            cs.overflowX === 'auto' ||
            cs.overflowX === 'scroll' ||
            cs.scrollSnapType.includes('mandatory')
          );
        });

        return containers.map((c) => {
          const content = c.querySelector('.SwipeReveal-content') ?? c.firstElementChild;
          const title = (content?.querySelector('h2, h3, h4, strong')?.textContent ?? '').trim();
          const btn = content?.querySelector('button');
          if (!btn || !title) return { hasMatch: false };
          const ariaLabel = btn.getAttribute('aria-label')?.trim() ?? '';
          const ariaLabelledBy = btn.getAttribute('aria-labelledby')?.trim() ?? '';
          let name = ariaLabel || (btn.textContent ?? '').trim();
          if (ariaLabelledBy) {
            name = ariaLabelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
              .join(' ');
          }
          return {
            hasMatch: name.toLowerCase().includes(title.toLowerCase()),
          };
        });
      });

      expect(checks.length).toBeGreaterThan(0);
      expect(checks.every((c) => c.hasMatch)).toBe(true);
    });

    test('Revealed panel controls start with tabindex="-1" when hidden and update to tabindex="0" when visible', async ({
      page,
    }) => {
      const initialTabIndexes = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll<HTMLElement>('.SwipeReveal, .grid > *')).filter((el) => {
          const cs = window.getComputedStyle(el);
          return (
            el.classList.contains('SwipeReveal') ||
            cs.overflowX === 'auto' ||
            cs.overflowX === 'scroll' ||
            cs.scrollSnapType.includes('mandatory')
          );
        });
        const first = containers[0];
        if (!first) return [];
        first.setAttribute('data-grader-swipe-target', '0');
        const content = first.querySelector('.SwipeReveal-content') ?? first.firstElementChild;
        const btn = content?.querySelector('button');
        if (btn) btn.setAttribute('data-grader-swipe-trigger', '0');
        const panel = first.querySelector('.SwipeReveal-panel') ?? first.lastElementChild;
        if (!panel) return [];
        return Array.from(panel.querySelectorAll('button, a[href]')).map((el) =>
          el.getAttribute('tabindex'),
        );
      });
      expect(initialTabIndexes.length).toBeGreaterThan(0);
      expect(initialTabIndexes.every((t) => t === '-1')).toBe(true);

      const trigger = page.locator('[data-grader-swipe-trigger="0"]').first();
      await expect(trigger).toBeVisible();
      await trigger.click();

      await expect
        .poll(() =>
          page.evaluate(() => {
            const c = document.querySelector<HTMLElement>('[data-grader-swipe-target="0"]');
            const panel = c?.querySelector('.SwipeReveal-panel') ?? c?.lastElementChild;
            if (!panel) return false;
            const controls = Array.from(panel.querySelectorAll('button, a[href]'));
            return controls.length > 0 && controls.every((el) => el.getAttribute('tabindex') === '0');
          }),
        )
        .toBe(true);
    });

    test('Associated trigger button reports revealed state via aria-expanded="true" when visible and "false" when hidden', async ({
      page,
    }) => {
      const hasTrigger = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll<HTMLElement>('.SwipeReveal, .grid > *')).filter((el) => {
          const cs = window.getComputedStyle(el);
          return (
            el.classList.contains('SwipeReveal') ||
            cs.overflowX === 'auto' ||
            cs.overflowX === 'scroll' ||
            cs.scrollSnapType.includes('mandatory')
          );
        });
        const first = containers[0];
        if (!first) return false;
        const content = first.querySelector('.SwipeReveal-content') ?? first.firstElementChild;
        const btn = content?.querySelector('button');
        if (!btn) return false;
        btn.setAttribute('data-grader-swipe-trigger', '0');
        return true;
      });
      expect(hasTrigger).toBe(true);

      const trigger = page.locator('[data-grader-swipe-trigger="0"]').first();
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
