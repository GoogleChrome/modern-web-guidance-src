import { test, expect } from '@playwright/test';

// Helper to get target file path from environment variable
const getTargetUrl = (): string => {
  const targetFile = process.env.TARGET_FILE;
  if (!targetFile) {
    throw new Error('TARGET_FILE environment variable is not defined');
  }
  return `file://${targetFile}`;
};

test.describe('Cross-document Transitions Grader', () => {

  test('The @view-transition at-rule is defined with navigation: auto to enable cross-document transitions', async ({ page }) => {
    await page.goto(getTargetUrl());

    const hasViewTransition = await page.evaluate(() => {
      const checkRule = (rule: any): boolean => {
        if (rule.constructor.name === 'CSSViewTransitionRule') {
          return true;
        }
        if (rule.cssText && rule.cssText.includes('@view-transition') && rule.cssText.includes('navigation') && rule.cssText.includes('auto')) {
          return true;
        }
        if (rule.cssRules) {
          for (const subRule of Array.from(rule.cssRules)) {
            if (checkRule(subRule)) return true;
          }
        }
        return false;
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (checkRule(rule)) return true;
          }
        } catch (e) {
          // ignore cross-origin errors
        }
      }
      return false;
    });

    expect(hasViewTransition).toBe(true);
  });

  test('The @view-transition rule is wrapped in a prefers-reduced-motion: no-preference media query to respect user accessibility settings', async ({ page }) => {
    await page.goto(getTargetUrl());

    const isWrapped = await page.evaluate(() => {
      const checkRule = (rule: any, insideMedia = false): boolean => {
        let currentInside = insideMedia;
        if (rule.constructor.name === 'CSSMediaRule') {
          const mediaText = rule.media.mediaText || '';
          if (mediaText.includes('prefers-reduced-motion') && mediaText.includes('no-preference')) {
            currentInside = true;
          }
        }
        if (rule.constructor.name === 'CSSViewTransitionRule' || (rule.cssText && rule.cssText.includes('@view-transition'))) {
          return currentInside;
        }
        if (rule.cssRules) {
          for (const subRule of Array.from(rule.cssRules)) {
            if (checkRule(subRule, currentInside)) return true;
          }
        }
        return false;
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (checkRule(rule)) return true;
          }
        } catch (e) {
          // ignore cross-origin errors
        }
      }
      return false;
    });

    expect(isWrapped).toBe(true);
  });

  test('Custom animations are defined for different transition types using the :active-view-transition-type() pseudo-class', async ({ page }) => {
    await page.goto(getTargetUrl());

    const hasTypesInCSS = await page.evaluate(() => {
      let hasNext = false;
      let hasPrevious = false;
      
      const checkRule = (rule: any) => {
        const text = rule.cssText || '';
        if (text.includes(':active-view-transition-type(next)')) {
          hasNext = true;
        }
        if (text.includes(':active-view-transition-type(previous)')) {
          hasPrevious = true;
        }
        if (rule.cssRules) {
          for (const subRule of Array.from(rule.cssRules)) {
            checkRule(subRule);
          }
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            checkRule(rule);
          }
        } catch (e) {
          // ignore cross-origin errors
        }
      }
      return hasNext && hasPrevious;
    });

    expect(hasTypesInCSS).toBe(true);
  });

  test('A pagereveal event listener is added to the window to dynamically add transition types to the viewTransition object', async ({ page }) => {
    // Inject script to record the view transition types during pagereveal on the new page
    await page.addInitScript(() => {
      window.addEventListener('pagereveal', (e: any) => {
        if (e.viewTransition) {
          setTimeout(() => {
            (window as any).__capturedTransitionTypes = Array.from(e.viewTransition.types);
          }, 0);
        }
      });
    });

    await page.goto(`${getTargetUrl()}?page=1`);

    // Click the next page link to trigger same-origin navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }).catch(() => {}),
      page.click('#next')
    ]);

    // Wait for navigation and check if types are captured
    await page.waitForTimeout(500);

    const capturedTypes = await page.evaluate(() => (window as any).__capturedTransitionTypes);

    expect(capturedTypes || []).toContain('next');
  });

  test('The page-level transition animations use ::view-transition-old(root) and ::view-transition-new(root) to create slide or fade effects', async ({ page }) => {
    await page.goto(getTargetUrl());

    const hasPageElements = await page.evaluate(() => {
      let hasOldRoot = false;
      let hasNewRoot = false;

      const checkRule = (rule: any) => {
        const text = rule.cssText || '';
        if (text.includes('::view-transition-old(root)')) {
          hasOldRoot = true;
        }
        if (text.includes('::view-transition-new(root)')) {
          hasNewRoot = true;
        }
        if (rule.cssRules) {
          for (const subRule of Array.from(rule.cssRules)) {
            checkRule(subRule);
          }
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            checkRule(rule);
          }
        } catch (e) {
          // ignore cross-origin errors
        }
      }
      return hasOldRoot && hasNewRoot;
    });

    expect(hasPageElements).toBe(true);
  });

});
