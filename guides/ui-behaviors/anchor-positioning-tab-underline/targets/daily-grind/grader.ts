import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import type { Page } from '@playwright/test';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSNestedDeclarations,
  type CSSRule,
  type CSSStyleSheet,
  type CSSStyleDeclaration,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectActiveCssRules(ruleList: Iterable<CSSRule>): CSSRule[] {
  const collected: CSSRule[] = [];
  for (const rule of ruleList) {
    if (rule instanceof CSSSupportsRule && /^\s*not\b/i.test(rule.conditionText)) {
      continue;
    }
    collected.push(rule);
    if ('cssRules' in rule && rule.cssRules) {
      collected.push(...collectActiveCssRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return collected;
}

function getActiveStyleDeclarations(stylesheet: CSSStyleSheet): CSSStyleDeclaration[] {
  return collectActiveCssRules(stylesheet.cssRules)
    .filter(
      (rule): rule is CSSStyleRule | CSSNestedDeclarations =>
        rule instanceof CSSStyleRule || rule instanceof CSSNestedDeclarations,
    )
    .map((rule) => rule.style);
}

interface NavUnderlineMetrics {
  active: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  underline: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    maxTransitionDuration: number;
    isVisible: boolean;
  };
}

async function getNavUnderlineAndActiveMetrics(page: Page): Promise<NavUnderlineMetrics | null> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return null;

    const navElements = Array.from(nav.querySelectorAll<HTMLElement>('*'));
    const activeEl: HTMLElement | null =
      navElements.find((el) =>
        window.getComputedStyle(el).getPropertyValue('anchor-name').trim().startsWith('--'),
      ) ??
      nav.querySelector<HTMLElement>(
        'li.active, a[aria-current="page"], [aria-selected="true"], .active',
      );

    if (!activeEl) return null;
    const activeRect = activeEl.getBoundingClientRect();

    const parseMaxDuration = (durationStr: string, propertyStr: string): number => {
      if (propertyStr.trim() === 'none') return 0;
      const durations = durationStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          if (s.endsWith('ms')) return parseFloat(s) / 1000;
          if (s.endsWith('s')) return parseFloat(s);
          return parseFloat(s) || 0;
        });
      return durations.length > 0 ? Math.max(...durations) : 0;
    };

    const candidateHosts: HTMLElement[] = [
      ...Array.from(nav.querySelectorAll<HTMLElement>('ul, ol')),
      nav,
      ...navElements,
    ];

    let underlineInfo: NavUnderlineMetrics['underline'] | null = null;

    for (const host of candidateHosts) {
      for (const pseudo of ['::before', '::after'] as const) {
        const style = window.getComputedStyle(host, pseudo);
        const content = style.content;
        if (
          content &&
          content !== 'none' &&
          content !== 'normal' &&
          (style.position === 'absolute' || style.position === 'fixed')
        ) {
          let cbLeft = 0;
          let cbTop = 0;
          if (style.position === 'absolute') {
            let cb: HTMLElement | null = host;
            while (cb && cb !== document.documentElement) {
              if (window.getComputedStyle(cb).position !== 'static') break;
              cb = cb.parentElement;
            }
            const cbEl = cb ?? document.documentElement;
            const cbRect = cbEl.getBoundingClientRect();
            const cbStyle = window.getComputedStyle(cbEl);
            cbLeft = cbRect.left + (parseFloat(cbStyle.borderLeftWidth) || 0);
            cbTop = cbRect.top + (parseFloat(cbStyle.borderTopWidth) || 0);
          }

          const left = cbLeft + parseFloat(style.left);
          const top = cbTop + parseFloat(style.top);
          const width = parseFloat(style.width);
          const height = parseFloat(style.height);
          const bg = style.backgroundColor;
          const borderBottomWidth = parseFloat(style.borderBottomWidth) || 0;
          const hasColor =
            (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ||
            borderBottomWidth > 0 ||
            style.backgroundImage !== 'none';

          if (Number.isFinite(left) && Number.isFinite(top) && width > 0 && height > 0 && hasColor) {
            underlineInfo = {
              left,
              right: left + width,
              top,
              bottom: top + height,
              width,
              height,
              maxTransitionDuration: parseMaxDuration(
                style.transitionDuration,
                style.transitionProperty,
              ),
              isVisible:
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                parseFloat(style.opacity || '1') > 0,
            };
            break;
          }
        }
      }
      if (underlineInfo) break;
    }

    if (!underlineInfo) {
      const anchoredEl = navElements.find((el) =>
        window.getComputedStyle(el).getPropertyValue('position-anchor').trim().startsWith('--'),
      );
      if (anchoredEl) {
        const style = window.getComputedStyle(anchoredEl);
        const rect = anchoredEl.getBoundingClientRect();
        const bg = style.backgroundColor;
        const borderBottomWidth = parseFloat(style.borderBottomWidth) || 0;
        const hasColor =
          (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ||
          borderBottomWidth > 0 ||
          style.backgroundImage !== 'none';

        if (rect.width > 0 && rect.height > 0 && hasColor) {
          underlineInfo = {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            maxTransitionDuration: parseMaxDuration(
              style.transitionDuration,
              style.transitionProperty,
            ),
            isVisible:
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              parseFloat(style.opacity || '1') > 0,
          };
        }
      }
    }

    if (!underlineInfo) return null;

    return {
      active: {
        left: activeRect.left,
        right: activeRect.right,
        top: activeRect.top,
        bottom: activeRect.bottom,
        width: activeRect.width,
        height: activeRect.height,
      },
      underline: underlineInfo,
    };
  });
}

test.describe('anchor-positioning-tab-underline Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('HTML marks an initial active navigation tab item', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasActiveNavItem = docs.some((d) =>
      Boolean(
        d.document.querySelector(
          'nav .active, nav [aria-current="page"], nav [aria-current="true"], nav [aria-selected="true"]',
        ),
      ),
    );
    expect(hasActiveNavItem).toBe(true);
  });

  test('CSS tethers the underline element to the active tab item via anchor-name and position-anchor', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styles = getActiveStyleDeclarations(stylesheet);
    const anchorNames = styles
      .map((s) => s.getPropertyValue('anchor-name').trim())
      .filter((val) => val.startsWith('--'));
    const hasTetheredUnderline = anchorNames.some((anchorName) =>
      styles.some((s) => s.getPropertyValue('position-anchor').trim() === anchorName),
    );
    expect(hasTetheredUnderline).toBe(true);
  });

  test('CSS positions the underline inline start edge using anchor()', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styles = getActiveStyleDeclarations(stylesheet);
    const hasInlineStartAnchor = styles.some((s) => {
      const val =
        s.getPropertyValue('inset-inline-start') ||
        s.getPropertyValue('left') ||
        s.getPropertyValue('inset-inline') ||
        s.getPropertyValue('inset');
      return val.includes('anchor(') && /\b(left|start|self-start|inline-start)\b/.test(val);
    });
    expect(hasInlineStartAnchor).toBe(true);
  });

  test('CSS positions the underline inline end edge using anchor()', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styles = getActiveStyleDeclarations(stylesheet);
    const hasInlineEndAnchor = styles.some((s) => {
      const val =
        s.getPropertyValue('inset-inline-end') ||
        s.getPropertyValue('right') ||
        s.getPropertyValue('inset-inline') ||
        s.getPropertyValue('inset') ||
        s.getPropertyValue('inline-size') ||
        s.getPropertyValue('width');
      return (
        (val.includes('anchor(') && /\b(right|end|self-end|inline-end)\b/.test(val)) ||
        val.includes('anchor-size(')
      );
    });
    expect(hasInlineEndAnchor).toBe(true);
  });

  test('CSS positions the underline block start edge below the active tab item using anchor()', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styles = getActiveStyleDeclarations(stylesheet);
    const hasBlockStartAnchor = styles.some((s) => {
      const val =
        s.getPropertyValue('inset-block-start') ||
        s.getPropertyValue('top') ||
        s.getPropertyValue('inset-block') ||
        s.getPropertyValue('inset');
      return val.includes('anchor(') && /\b(bottom|end|self-end|block-end|outside)\b/.test(val);
    });
    expect(hasBlockStartAnchor).toBe(true);
  });

  test('CSS declares underline transition inside a prefers-reduced-motion: no-preference media query', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectActiveCssRules(stylesheet.cssRules);
    const mediaRules = allRules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule &&
        r.conditionText.includes('prefers-reduced-motion') &&
        r.conditionText.includes('no-preference'),
    );
    const hasMotionTransition = mediaRules.some((mediaRule) => {
      const nestedRules = collectActiveCssRules(mediaRule.cssRules);
      return nestedRules.some((r) => {
        if (!(r instanceof CSSStyleRule || r instanceof CSSNestedDeclarations)) return false;
        const transition = r.style.getPropertyValue('transition').trim();
        const transitionProp = r.style.getPropertyValue('transition-property').trim();
        const transitionDur = r.style.getPropertyValue('transition-duration').trim();
        return (
          (Boolean(transition) && transition !== 'none') ||
          (Boolean(transitionProp) && Boolean(transitionDur) && transitionDur !== '0s')
        );
      });
    });
    expect(hasMotionTransition).toBe(true);
  });

  test('JavaScript handles navigation item clicks to update the active tab item', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasClickHandler = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      const args = call.getArguments();
      return (
        exprText.endsWith('addEventListener') &&
        args.length >= 2 &&
        /^['"`]click['"`]$/.test(args[0].getText())
      );
    });
    const hasClassListUpdate = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      return /\bclassList\.(add|remove|toggle)\b/.test(exprText);
    });
    expect(hasClickHandler && hasClassListUpdate).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('There is an underline element visible under the active tab item', async ({ page }) => {
      const metrics = await getNavUnderlineAndActiveMetrics(page);
      expect(Boolean(metrics && metrics.underline.isVisible && metrics.underline.height > 0)).toBe(
        true,
      );
    });

    test('The underline element is the width of the active tab item', async ({ page }) => {
      const metrics = await getNavUnderlineAndActiveMetrics(page);
      const widthDiff = metrics
        ? Math.abs(metrics.underline.width - metrics.active.width)
        : Infinity;
      expect(widthDiff).toBeLessThanOrEqual(2);
    });

    test("The underline element's inline start edge is aligned to the active tab item's inline start edge", async ({
      page,
    }) => {
      const metrics = await getNavUnderlineAndActiveMetrics(page);
      const startDiff = metrics ? Math.abs(metrics.underline.left - metrics.active.left) : Infinity;
      expect(startDiff).toBeLessThanOrEqual(2);
    });

    test("The underline element's inline end edge is aligned to the active tab item's inline end edge", async ({
      page,
    }) => {
      const metrics = await getNavUnderlineAndActiveMetrics(page);
      const endDiff = metrics ? Math.abs(metrics.underline.right - metrics.active.right) : Infinity;
      expect(endDiff).toBeLessThanOrEqual(2);
    });

    test("The underline element's block start edge is positioned below the block end edge of the active tab item", async ({
      page,
    }) => {
      const metrics = await getNavUnderlineAndActiveMetrics(page);
      const offsetBelow = metrics ? metrics.underline.top - metrics.active.bottom : -Infinity;
      expect(offsetBelow).toBeGreaterThanOrEqual(0);
    });

    test('Changing the active page moves the underline element to be positioned underneath the new active tab item', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const initialMetrics = await getNavUnderlineAndActiveMetrics(page);
      const secondLink = page.locator('nav ul li:nth-child(2) a');
      await secondLink.click();
      const updatedMetrics = await getNavUnderlineAndActiveMetrics(page);
      const secondTabBox = await page.locator('nav ul li:nth-child(2)').boundingBox();

      const movedUnderNewTab = Boolean(
        initialMetrics &&
          updatedMetrics &&
          secondTabBox &&
          Math.abs(updatedMetrics.underline.left - initialMetrics.underline.left) > 5 &&
          Math.abs(updatedMetrics.underline.left - secondTabBox.x) <= 2 &&
          Math.abs(updatedMetrics.underline.width - secondTabBox.width) <= 2,
      );
      expect(movedUnderNewTab).toBe(true);
    });

    test('When prefers-reduced-motion: reduce is enabled, there is no animation', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const metrics = await getNavUnderlineAndActiveMetrics(page);
      const duration = metrics ? metrics.underline.maxTransitionDuration : null;
      expect(duration).toBe(0);
    });

    test('When prefers-reduced-motion: no-preference is enabled, the underline animates', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const metrics = await getNavUnderlineAndActiveMetrics(page);
      const duration = metrics ? metrics.underline.maxTransitionDuration : 0;
      expect(duration).toBeGreaterThan(0);
    });
  });
});
