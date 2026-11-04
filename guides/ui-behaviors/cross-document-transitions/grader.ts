import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve(import.meta.dirname, 'demo.html');
const targetDir = path.dirname(targetFile);
const fileName = path.basename(targetFile);
const getTargetUrl = (): string => `http://localhost/${fileName}`;

test.describe('Cross-document Transitions Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const url = new URL(route.request().url());
      let reqPath = decodeURIComponent(url.pathname);
      if (reqPath === '/' || reqPath === '') reqPath = `/${fileName}`;
      const fullPath = path.join(targetDir, reqPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const contentType =
          ext === '.html' ? 'text/html' :
          ext === '.css' ? 'text/css' :
          ext === '.js' || ext === '.mjs' ? 'application/javascript' :
          'application/octet-stream';
        await route.fulfill({
          status: 200,
          contentType,
          body: fs.readFileSync(fullPath),
        });
      } else if (reqPath.endsWith('.html') && fs.existsSync(targetFile)) {
        // Fallback when secondary HTML pages were not bundled separately:
        // serve the main HTML with #previous pointing back to the main file
        let html = fs.readFileSync(targetFile, 'utf-8');
        html = html.replace(
          /(<a\b[^>]*\bid=["']previous["'][^>]*\bhref=["'])[^"']*(['"][^>]*>)/i,
          `$1/${fileName}$2`
        ).replace(
          /(<a\b[^>]*\bhref=["'])[^"']*(['"][^>]*\bid=["']previous["'][^>]*>)/i,
          `$1/${fileName}$2`
        );
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: html,
        });
      } else {
        await route.continue();
      }
    });
  });

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

    await page.goto(getTargetUrl());
    const usesQueryParam = await page.evaluate(() => {
      const next = document.getElementById('next') as HTMLAnchorElement | null;
      return Boolean(next && next.getAttribute('href')?.includes('?page='));
    });
    if (usesQueryParam) {
      await page.goto(`${getTargetUrl()}?page=1`);
    }

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
