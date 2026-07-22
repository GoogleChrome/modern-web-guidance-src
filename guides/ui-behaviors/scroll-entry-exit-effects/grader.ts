import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

interface AnimationStyles {
  animationNames: string[];
  animationTimeline: string;
  animationRangeStart: string;
  animationRangeEnd: string;
  keyframesRules: string[];
  hasSupports: boolean;
  supportsCondition: string;
  hasMedia: boolean;
  mediaCondition: string;
}

async function getPageAnimationStyles(page: Page): Promise<AnimationStyles> {
  return page.evaluate(() => {
    const el = document.querySelector('.card') || document.querySelector('.scroller > *');
    if (!el) {
      return {
        animationNames: [],
        animationTimeline: '',
        animationRangeStart: '',
        animationRangeEnd: '',
        keyframesRules: [],
        hasSupports: false,
        supportsCondition: '',
        hasMedia: false,
        mediaCondition: '',
      };
    }
    const comp = window.getComputedStyle(el);
    const animationNames = comp.animationName.split(',').map(n => n.trim()).filter(n => n !== 'none');
    const animationTimeline = comp.getPropertyValue('animation-timeline') || (comp as any).animationTimeline || '';
    const animationRangeStart = comp.getPropertyValue('animation-range-start') || (comp as any).animationRangeStart || '';
    const animationRangeEnd = comp.getPropertyValue('animation-range-end') || (comp as any).animationRangeEnd || '';

    const keyframesRules: string[] = [];
    let hasSupports = false;
    let supportsCondition = '';
    let hasMedia = false;
    let mediaCondition = '';

    function traverse(rule: any) {
      if (rule instanceof CSSKeyframesRule) {
        keyframesRules.push(rule.name);
      } else if (rule instanceof CSSSupportsRule) {
        if (rule.conditionText.includes('animation-timeline')) {
          hasSupports = true;
          supportsCondition = rule.conditionText;
        }
      } else if (rule instanceof CSSMediaRule) {
        if (rule.conditionText.includes('prefers-reduced-motion')) {
          hasMedia = true;
          mediaCondition = rule.conditionText;
        }
      }
      if (rule.cssRules) {
        for (let i = 0; i < rule.cssRules.length; i++) {
          traverse(rule.cssRules[i]);
        }
      }
    }

    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (let j = 0; j < rules.length; j++) {
            traverse(rules[j]);
          }
        }
      } catch (e: any) {
        if (e.name === 'SecurityError' || (e.message && e.message.includes('cross-origin'))) {
          // Ignore cross-origin stylesheet access errors
          continue;
        } else {
          throw e;
        }
      }
    }

    return {
      animationNames,
      animationTimeline,
      animationRangeStart,
      animationRangeEnd,
      keyframesRules,
      hasSupports,
      supportsCondition,
      hasMedia,
      mediaCondition,
    };
  });
}

// Tests
test.describe(`Scroll-Driven Animations Expectations: ${demoName}`, () => {

  // Setup browser testing
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

  test('has defined separate @keyframes for entry and exit effects', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    expect(data.keyframesRules.length).toBeGreaterThanOrEqual(2);
  });

  test('has applied both animations to the target elements', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    expect(data.animationNames.length).toBeGreaterThanOrEqual(2);
  });

  test('has used animation-timeline: view() or view(inline) to link animations to the view timeline', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    expect(data.animationTimeline).toMatch(/view\(/);
  });

  test('has used animation-range: entry, exit to restrict animations', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const combinedRange = `${data.animationRangeStart} ${data.animationRangeEnd}`;
    const hasEntryAndExit = combinedRange.includes('entry') && combinedRange.includes('exit');
    expect(hasEntryAndExit).toBe(true);
  });

  test('includes feature detection using @supports', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const hasCorrectSupports = data.hasSupports && 
                               data.supportsCondition.includes('animation-timeline');
    expect(hasCorrectSupports).toBe(true);
  });

  test('respects user preferences for reduced motion using @media', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const hasCorrectMedia = data.hasMedia && data.mediaCondition.includes('prefers-reduced-motion');
    expect(hasCorrectMedia).toBe(true);
  });

});
