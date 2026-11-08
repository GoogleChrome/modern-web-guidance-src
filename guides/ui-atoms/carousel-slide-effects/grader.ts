import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Carousel Item Effects Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test(`The agent has defined an @keyframes block that defines states for start, center, and end`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasKeyframes = /@keyframes\s+[\w-]+\s*\{[\s\S]*?(0%|from)[\s\S]*?50%[\s\S]*?(100%|to)[\s\S]*?\}/i.test(html);
    expect(hasKeyframes).toBe(true);
  });

  test(`Carousel items link animation to an anonymous view() timeline or a named view-timeline`, async ({ page }) => {
    const timelineMatch = await page.evaluate(() => {
      const scroller = document.querySelector('.scroller') || document.body;
      const declaredNamedTimelines = new Set<string>();
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const vtName = (window.getComputedStyle(el) as any).viewTimelineName || '';
        for (const token of String(vtName).split(',')) {
          const trimmed = token.trim();
          if (trimmed.startsWith('--')) declaredNamedTimelines.add(trimmed);
        }
      }
      for (const el of Array.from(scroller.querySelectorAll('*'))) {
        const animTimeline = String((window.getComputedStyle(el) as any).animationTimeline || '').trim();
        if (!animTimeline || animTimeline === 'auto' || animTimeline === 'none') continue;
        if (animTimeline.includes('view(')) return { ok: true, animTimeline };
        if (animTimeline.startsWith('--') && declaredNamedTimelines.has(animTimeline)) {
          return { ok: true, animTimeline };
        }
      }
      return { ok: false, animTimeline: 'none' };
    });
    expect(timelineMatch.ok).toBe(true);
  });

  test(`Feature detection uses @supports checking scroll-driven timeline support and animation-range`, async ({ page }) => {
    const hasSupports = await page.evaluate(() => {
      function checkRule(rule: CSSRule): boolean {
        if (rule instanceof CSSSupportsRule) {
          const cond = rule.conditionText || '';
          const hasTimeline = cond.includes('animation-timeline') || cond.includes('view-timeline');
          const hasRange = cond.includes('animation-range');
          if (hasTimeline && hasRange) return true;
        }
        if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
          for (const child of Array.from((rule as CSSGroupingRule).cssRules)) {
            if (checkRule(child)) return true;
          }
        }
        return false;
      }
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (checkRule(rule)) return true;
          }
        } catch {
          // ignore cross-origin stylesheets
        }
      }
      return false;
    });
    expect(hasSupports).toBe(true);
  });

  test(`Animations respect user motion preferences using @media (prefers-reduced-motion)`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('prefers-reduced-motion');
  });

  test(`Carousel scroller contains a focusable element or is focusable with an accessible role and name`, async ({ page }) => {
    const accessible = await page.evaluate(() => {
      const scroller = document.querySelector('.scroller');
      if (!scroller) return false;
      const focusableSelector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';
      if (scroller.querySelector(focusableSelector)) return true;

      const tabIndexAttr = scroller.getAttribute('tabindex');
      if (tabIndexAttr === null || Number(tabIndexAttr) < 0) return false;

      const explicitRole = (scroller.getAttribute('role') || '').trim().toLowerCase();
      const namedExplicitRoles = new Set(['region', 'group', 'list', 'listbox', 'toolbar', 'grid', 'tablist', 'feed', 'tree', 'application']);
      const implicitNamedTags = new Set(['UL', 'OL', 'NAV', 'MAIN', 'ASIDE', 'ARTICLE', 'SECTION']);
      const hasNamedRole = namedExplicitRoles.has(explicitRole) || (explicitRole === '' && implicitNamedTags.has(scroller.tagName));
      if (!hasNamedRole) return false;

      const ariaLabel = (scroller.getAttribute('aria-label') || '').trim();
      const labelledByIds = (scroller.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
      const labelledByText = labelledByIds
        .map(id => document.getElementById(id)?.textContent?.trim() || '')
        .join(' ')
        .trim();
      const titleAttr = (scroller.getAttribute('title') || '').trim();
      return Boolean(ariaLabel || labelledByText || titleAttr);
    });
    expect(accessible).toBe(true);
  });

});
