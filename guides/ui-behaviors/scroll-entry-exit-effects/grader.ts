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
  declaredViewTimelines: string[];
  animationRangeStart: string;
  animationRangeEnd: string;
  keyframesRules: { name: string; selectors: string[] }[];
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
        declaredViewTimelines: [],
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

    const declaredViewTimelines: string[] = [];
    for (const node of Array.from(document.querySelectorAll('*'))) {
      const vtName = (window.getComputedStyle(node) as any).viewTimelineName || '';
      for (const token of String(vtName).split(',')) {
        const trimmed = token.trim();
        if (trimmed.startsWith('--')) declaredViewTimelines.push(trimmed);
      }
    }

    const keyframesRules: { name: string; selectors: string[] }[] = [];
    let hasSupports = false;
    let supportsCondition = '';
    let hasMedia = false;
    let mediaCondition = '';

    function traverse(rule: any) {
      if (rule instanceof CSSKeyframesRule) {
        const selectors: string[] = [];
        for (let k = 0; k < rule.cssRules.length; k++) {
          selectors.push((rule.cssRules[k] as CSSKeyframeRule).keyText || '');
        }
        keyframesRules.push({ name: rule.name, selectors });
      } else if (rule instanceof CSSSupportsRule) {
        if (rule.conditionText.includes('animation-timeline') || rule.conditionText.includes('view-timeline')) {
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
      declaredViewTimelines,
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

function hasEntryAndExitSelectors(selectors: string[]): boolean {
  const joined = selectors.join(' ');
  return /\bentry\b/.test(joined) && /\bexit\b/.test(joined);
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

  test('Keyframes define entry and exit effects (two @keyframes or single @keyframes with entry/exit selectors)', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const hasTwoKeyframes = data.keyframesRules.length >= 2;
    const hasSingleRangeKeyframes = data.keyframesRules.some(kf => hasEntryAndExitSelectors(kf.selectors));
    expect(hasTwoKeyframes || hasSingleRangeKeyframes).toBe(true);
  });

  test('Target elements attach entry and exit animation(s)', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const hasTwoAnimations = data.animationNames.length >= 2;
    const hasSingleRangeAnimation = data.animationNames.length >= 1 && data.keyframesRules.some(
      kf => data.animationNames.includes(kf.name) && hasEntryAndExitSelectors(kf.selectors)
    );
    expect(hasTwoAnimations || hasSingleRangeAnimation).toBe(true);
  });

  test('Target elements link animations to an anonymous view() timeline or named view-timeline', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const usesAnonymousView = /view\(/.test(data.animationTimeline);
    const usesNamedViewTimeline = data.animationTimeline.split(',')
      .map(t => t.trim())
      .some(t => t.startsWith('--') && data.declaredViewTimelines.includes(t));
    expect(usesAnonymousView || usesNamedViewTimeline).toBe(true);
  });

  test('Animations are restricted to entry and exit via animation-range or keyframe selectors', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const combinedRange = `${data.animationRangeStart} ${data.animationRangeEnd}`;
    const hasRangeProperty = combinedRange.includes('entry') && combinedRange.includes('exit');
    const hasRangeKeyframes = data.keyframesRules.some(
      kf => data.animationNames.includes(kf.name) && hasEntryAndExitSelectors(kf.selectors)
    );
    expect(hasRangeProperty || hasRangeKeyframes).toBe(true);
  });

  test('Feature detection uses @supports for scroll-driven timeline support and animation-range', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const cond = data.supportsCondition;
    const hasTimeline = cond.includes('animation-timeline') || cond.includes('view-timeline');
    const hasRange = cond.includes('animation-range');
    expect(data.hasSupports && hasTimeline && hasRange).toBe(true);
  });

  test('User preferences for reduced motion are respected using @media (prefers-reduced-motion)', async ({ page }) => {
    const data = await getPageAnimationStyles(page);
    const hasCorrectMedia = data.hasMedia && data.mediaCondition.includes('prefers-reduced-motion');
    expect(hasCorrectMedia).toBe(true);
  });

});
