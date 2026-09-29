import * as fs from 'fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type Project, type CallExpression } from 'ts-morph';
import type { Document } from 'linkedom';
import {
  CSSRule,
  CSSGroupingRule,
  CSSStyleRule,
  CSSSupportsRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-expect-error import.meta is supported by Playwright ESM runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectStyleRules(Array.from((rule as CSSGroupingRule).cssRules)));
    }
  }
  return result;
}

function collectSupportsRules(rules: CSSRule[]): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSSupportsRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectSupportsRules(Array.from((rule as CSSGroupingRule).cssRules)));
    }
  }
  return result;
}

test.describe('faster-spa-view-transitions Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('Basic presence: the modified source files contain content-visibility', () => {
    const hasContentVisibility = targetFiles.some(
      (f) => fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('content-visibility'),
    );
    expect(hasContentVisibility).toBe(true);
  });

  test('HTML defines multiple focusable SPA view containers', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasMultipleViews = docs.some((d) => {
      const views = d.document.querySelectorAll(
        '.spa-view, [data-view-container], main > section[id], #view-root > section[id]',
      );
      return views.length >= 2;
    });
    expect(hasMultipleViews).toBe(true);
  });

  test('CSS defines content-visibility: hidden rule for inactive views', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));
    const hasHiddenRule = styleRules.some(
      (r) => r.style.getPropertyValue('content-visibility').trim() === 'hidden',
    );
    expect(hasHiddenRule).toBe(true);
  });

  test('CSS provides @supports fallback with display: none when content-visibility is not supported', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const supportsRules = collectSupportsRules(Array.from(stylesheet.cssRules));
    const hasSupportsFallback = supportsRules.some((sr) => {
      const condition = sr.conditionText.toLowerCase();
      if (!condition.includes('not') || !condition.includes('content-visibility')) {
        return false;
      }
      const nestedRules = collectStyleRules(Array.from(sr.cssRules));
      return nestedRules.some((r) => r.style.getPropertyValue('display').trim() === 'none');
    });
    expect(hasSupportsFallback).toBe(true);
  });

  test('JavaScript transitions manage aria-hidden and focus on view containers', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions: CallExpression[] = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const setsAriaHidden = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) return false;
      if (expr.getName() !== 'setAttribute') return false;
      const firstArg = call.getArguments()[0];
      return Boolean(firstArg && firstArg.getText().includes('aria-hidden'));
    });

    const callsFocus = callExpressions.some((call) => {
      const expr = call.getExpression();
      return expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'focus';
    });

    expect(setsAriaHidden && callsFocus).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Inactive view elements have content-visibility: hidden applied in their computed styles', async ({
      page,
    }) => {
      const inactiveViewsHaveHiddenContentVisibility = await page.evaluate(() => {
        const views = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.spa-view, [data-view-container], main > section[id], #view-root > section[id]',
          ),
        );
        if (views.length < 2) return false;
        const inactiveViews = views.filter(
          (v) => v.classList.contains('inactive') || v.getAttribute('aria-hidden') === 'true',
        );
        if (inactiveViews.length === 0) return false;
        return inactiveViews.every(
          (v) => window.getComputedStyle(v).contentVisibility === 'hidden',
        );
      });
      expect(inactiveViewsHaveHiddenContentVisibility).toBe(true);
    });

    test('The active view element does not have content-visibility: hidden applied', async ({
      page,
    }) => {
      const activeViewIsVisible = await page.evaluate(() => {
        const views = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.spa-view, [data-view-container], main > section[id], #view-root > section[id]',
          ),
        );
        if (views.length < 2) return false;
        const activeViews = views.filter(
          (v) => !v.classList.contains('inactive') && v.getAttribute('aria-hidden') !== 'true',
        );
        const inactiveViews = views.filter((v) => !activeViews.includes(v));
        if (activeViews.length !== 1 || inactiveViews.length === 0) return false;
        const activeStyle = window.getComputedStyle(activeViews[0]).contentVisibility;
        return activeStyle !== 'hidden' && (activeStyle === 'visible' || activeStyle === '');
      });
      expect(activeViewIsVisible).toBe(true);
    });

    test('Switching between views toggles the content-visibility state', async ({ page }) => {
      const menuLink = page.locator('nav a', { hasText: 'Menu' }).first();
      await menuLink.click();

      const toggledProperly = await page.evaluate(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const views = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.spa-view, [data-view-container], main > section[id], #view-root > section[id]',
          ),
        );
        if (views.length < 2) return false;
        const menuView =
          document.getElementById('menu') ||
          document.getElementById('view-menu') ||
          views.find((v) => v.id.includes('menu'));
        const homeView =
          document.getElementById('home') ||
          document.getElementById('view-home') ||
          views.find((v) => v.id.includes('home'));
        if (!menuView || !homeView) return false;

        const menuVisibility = window.getComputedStyle(menuView).contentVisibility;
        const homeVisibility = window.getComputedStyle(homeView).contentVisibility;
        return menuVisibility !== 'hidden' && homeVisibility === 'hidden';
      });
      expect(toggledProperly).toBe(true);
    });

    test('Inactive view elements have aria-hidden="true" applied across transitions', async ({
      page,
    }) => {
      const menuLink = page.locator('nav a', { hasText: 'Menu' }).first();
      await menuLink.click();

      const ariaHiddenApplied = await page.evaluate(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const views = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.spa-view, [data-view-container], main > section[id], #view-root > section[id]',
          ),
        );
        if (views.length < 2) return false;
        const menuView =
          document.getElementById('menu') ||
          document.getElementById('view-menu') ||
          views.find((v) => v.id.includes('menu'));
        if (!menuView) return false;

        const inactiveViews = views.filter((v) => v !== menuView);
        return (
          inactiveViews.length > 0 &&
          inactiveViews.every((v) => v.getAttribute('aria-hidden') === 'true') &&
          menuView.getAttribute('aria-hidden') !== 'true'
        );
      });
      expect(ariaHiddenApplied).toBe(true);
    });

    test('Focus moves to the active view container upon transition', async ({ page }) => {
      const menuLink = page.locator('nav a', { hasText: 'Menu' }).first();
      await menuLink.click();

      const focusMoved = await page.evaluate(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const views = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.spa-view, [data-view-container], main > section[id], #view-root > section[id]',
          ),
        );
        if (views.length < 2) return false;
        const menuView =
          document.getElementById('menu') ||
          document.getElementById('view-menu') ||
          views.find((v) => v.id.includes('menu'));
        if (!menuView) return false;

        return (
          document.activeElement === menuView ||
          (document.activeElement instanceof Node && menuView.contains(document.activeElement))
        );
      });
      expect(focusMoved).toBe(true);
    });
  });
});
