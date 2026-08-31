import {
  test,
  expect,
  getTargetFiles,
  extractAllCss,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import { pathToFileURL } from 'url';
import * as path from 'path';

const currentFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;

const targetFiles: string[] = getTargetFiles(currentFileUrl);

test.describe('faster-spa-view-transitions Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('CSS rules configure content-visibility: hidden for inactive views', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    expect(cleanCss).toMatch(/\bcontent-visibility\s*:\s*hidden\b/i);
  });

  test('CSS provides a display: none fallback when content-visibility is not supported', () => {
    const cleanCss: string = extractAllCss(targetFiles);
    const hasSupportsFallback = /@supports\s+not\s*\(\s*content-visibility\s*:\s*hidden\s*\)\s*\{[\s\S]*?display\s*:\s*none/i.test(cleanCss);
    expect(hasSupportsFallback).toBe(true);
  });

  test('HTML structure applies aria-hidden="true" to inactive view elements (linkedom)', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasInactiveAriaHidden = docs.some(({ document }) => {
      const inactiveViews = document.querySelectorAll('.spa-view.inactive, [aria-hidden="true"]');
      return inactiveViews.length > 0 && Array.from(inactiveViews).some((el: any) => el.getAttribute('aria-hidden') === 'true');
    });
    expect(hasInactiveAriaHidden).toBe(true);
  });

  test('JavaScript maintains focus management by calling focus on the active view (ts-morph)', () => {
    const project = getJsProject(targetFiles);
    const calls = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasFocusCall = calls.some(call => {
      const expr = call.getExpression();
      return expr.getText().endsWith('.focus');
    });
    expect(hasFocusCall).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('inactive view elements have content-visibility: hidden applied in computed styles', async ({ page }) => {
      const inactiveHidden = await page.evaluate(() => {
        const views = Array.from(document.querySelectorAll('.spa-view, [data-view], [id*="view"]'));
        const inactive = views.filter(el =>
          el.classList.contains('inactive') || el.getAttribute('aria-hidden') === 'true'
        );
        if (inactive.length === 0) return false;
        return inactive.every(el => window.getComputedStyle(el).getPropertyValue('content-visibility') === 'hidden');
      });
      expect(inactiveHidden).toBe(true);
    });

    test('active view element does not have content-visibility: hidden applied', async ({ page }) => {
      const activeVisible = await page.evaluate(() => {
        const views = Array.from(document.querySelectorAll('.spa-view, [data-view], [id*="view"]'));
        const active = views.filter(el =>
          !el.classList.contains('inactive') && el.getAttribute('aria-hidden') !== 'true'
        );
        if (active.length === 0) return false;
        return active.every(el => window.getComputedStyle(el).getPropertyValue('content-visibility') !== 'hidden');
      });
      expect(activeVisible).toBe(true);
    });

    test('toggles content-visibility state when switching between views', async ({ page }) => {
      const isToggled = await page.evaluate(() => {
        const menuLink = document.querySelector('nav a[href*="menu"], [data-view*="menu"], [data-view-link*="menu"]') as HTMLElement | null;
        if (!menuLink) return false;
        menuLink.click();
        const menuView = document.querySelector('#menu, #view-menu, [data-view="menu"]');
        const homeView = document.querySelector('#home, #view-home, [data-view="home"]');
        if (!menuView || !homeView) return false;
        const menuVisibility = window.getComputedStyle(menuView).getPropertyValue('content-visibility');
        const homeVisibility = window.getComputedStyle(homeView).getPropertyValue('content-visibility');
        return menuVisibility !== 'hidden' && homeVisibility === 'hidden';
      });
      expect(isToggled).toBe(true);
    });

    test('updates aria-hidden attribute when switching views', async ({ page }) => {
      const ariaUpdated = await page.evaluate(() => {
        const menuLink = document.querySelector('nav a[href*="menu"], [data-view*="menu"], [data-view-link*="menu"]') as HTMLElement | null;
        if (!menuLink) return false;
        menuLink.click();
        const menuView = document.querySelector('#menu, #view-menu, [data-view="menu"]');
        const homeView = document.querySelector('#home, #view-home, [data-view="home"]');
        if (!menuView || !homeView) return false;
        return menuView.getAttribute('aria-hidden') === 'false' && homeView.getAttribute('aria-hidden') === 'true';
      });
      expect(ariaUpdated).toBe(true);
    });

    test('moves focus to the active view container upon transition', async ({ page }) => {
      const focusMoved = await page.evaluate(() => {
        const menuLink = document.querySelector('nav a[href*="menu"], [data-view*="menu"], [data-view-link*="menu"]') as HTMLElement | null;
        if (!menuLink) return false;
        menuLink.click();
        const menuView = document.querySelector('#menu, #view-menu, [data-view="menu"]');
        if (!menuView) return false;
        return document.activeElement === menuView;
      });
      expect(focusMoved).toBe(true);
    });
  });
});
