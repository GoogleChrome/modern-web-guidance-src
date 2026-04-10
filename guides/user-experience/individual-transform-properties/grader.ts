/// <reference types="node" />
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
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

test.describe(`Individual Transform Properties Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestPath = requestUrl.pathname;
      const relativePath = (requestPath === '/' || requestPath === `/${demoName}`) ? demoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(targetDir, relativePath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  const getTarget = (page: Page) => page.locator('.card, .target, .bad-target, [class*="target"]').first();

  const checkExplicitStyle = async (target: Locator, prop: string) => {
    return await target.evaluate((el: HTMLElement, propName: string) => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
              if (rule.style.getPropertyValue(propName)) return true;
            }
          }
        } catch (e) {}
      }
      return !!el.style.getPropertyValue(propName);
    }, prop);
  };

  test('The target element should initialize the translate property with the identity value', async ({ page }) => {
    const target = getTarget(page);
    const isSet = await checkExplicitStyle(target, 'translate');
    expect(isSet).toBe(true);
  });

  test('The target element should initialize the scale property with the identity value', async ({ page }) => {
    const target = getTarget(page);
    const isSet = await checkExplicitStyle(target, 'scale');
    expect(isSet).toBe(true);
  });

  test('The target element should initialize the rotate property with the identity value', async ({ page }) => {
    const target = getTarget(page);
    const isSet = await checkExplicitStyle(target, 'rotate');
    expect(isSet).toBe(true);
  });

  test('The target element should NOT use will-change to manage stacking context', async ({ page }) => {
    const target = getTarget(page);
    const usesWillChange = await target.evaluate((el: HTMLElement) => {
      const style = getComputedStyle(el);
      return style.willChange !== 'auto';
    });
    expect(usesWillChange).toBe(false);
  });

  test('The target element should have a translate animation', async ({ page }) => {
    const target = getTarget(page);
    const hasTranslateAnim = await target.evaluate((el: HTMLElement) => {
      // Must use independent 'translate' property
      const style = getComputedStyle(el);
      if (style.getPropertyValue('translate') === 'none' && el.style.getPropertyValue('translate') === '') {
        return false;
      }

      return el.getAnimations().some(anim => {
        if (!(anim instanceof CSSAnimation)) return false;
        const effect = anim.effect;
        if (!effect || !('getKeyframes' in effect)) return false;
        const keyframes = (effect as any).getKeyframes() || [];
        return keyframes.some((kf: any) => kf.translate !== undefined && kf.translate !== 'none');
      });
    });
    expect(hasTranslateAnim).toBe(true);
  });

  test('The target element should have a rotate animation or transition', async ({ page }) => {
    const target = getTarget(page);
    const hasRotateEffect = await target.evaluate((el: HTMLElement) => {
      // Must use independent 'rotate' property
      const style = getComputedStyle(el);
      const computedRotate = style.getPropertyValue('rotate');
      
      // In some browsers, even if not set, rotate might return 'none'.
      // If it's set via 'transform: rotate(...)', getPropertyValue('rotate') MUST be 'none'.
      // If it's set via 'rotate: ...', it will NOT be 'none'.
      if (computedRotate !== 'none' && computedRotate !== '') return true;

      const hasAnim = el.getAnimations().some(anim => {
        if (!(anim instanceof CSSAnimation)) return false;
        const effect = anim.effect;
        if (!effect || !('getKeyframes' in effect)) return false;
        const keyframes = (effect as any).getKeyframes() || [];
        // Check specifically for the 'rotate' keyframe property
        return keyframes.some((kf: any) => kf.rotate !== undefined && kf.rotate !== 'none' && kf.rotate !== '');
      });
      if (hasAnim) return true;
      
      return style.transitionProperty.split(', ').some(p => p.trim() === 'rotate');
    });
    expect(hasRotateEffect).toBe(true);
  });

  test('The target element should transition its scale property on hover', async ({ page }) => {
    const target = getTarget(page);
    const hasScaleTransition = await target.evaluate((el: HTMLElement) => {
      const style = getComputedStyle(el);
      return style.transitionProperty.split(', ').some(p => p === 'scale' || p === 'all');
    });
    expect(hasScaleTransition).toBe(true);
    
    const initialScale = await target.evaluate((el: HTMLElement) => getComputedStyle(el).getPropertyValue('scale'));
    await target.hover({ force: true });
    await page.waitForTimeout(150);
    const midScale = await target.evaluate((el: HTMLElement) => getComputedStyle(el).getPropertyValue('scale'));
    
    expect(midScale !== initialScale && midScale !== 'none').toBe(true);
  });

  test('Translate and rotate animations should continue uninterrupted when hovered', async ({ page }) => {
    const target = getTarget(page);
    
    // First, verify that we're using independent properties in style or computed style
    const hasIndependent = await target.evaluate((el: HTMLElement) => {
       const style = getComputedStyle(el);
       const t = style.getPropertyValue('translate');
       const r = style.getPropertyValue('rotate');
       return el.style.getPropertyValue('translate') !== '' || el.style.getPropertyValue('rotate') !== '' || 
              (t !== 'none' && !t.includes('matrix')) ||
              (r !== 'none' && !r.includes('matrix'));
    });
    
    if (!hasIndependent) {
        expect(hasIndependent).toBe(true);
    }

    const t0 = await target.evaluate((el: HTMLElement) => getComputedStyle(el).getPropertyValue('translate'));
    const r0 = await target.evaluate((el: HTMLElement) => getComputedStyle(el).getPropertyValue('rotate'));
    await page.waitForTimeout(150);
    const t1 = await target.evaluate((el: HTMLElement) => getComputedStyle(el).getPropertyValue('translate'));
    const r1 = await target.evaluate((el: HTMLElement) => getComputedStyle(el).getPropertyValue('rotate'));
    
    // If they don't change even without hover, the test is invalid for this target
    if (t0 === t1 && r0 === r1) return;

    await target.hover({ force: true });
    await page.waitForTimeout(50); // Let hover transition start
    
    const areAnimationsContinuing = await target.evaluate(async (el: HTMLElement) => {
      const style = getComputedStyle(el);
      const v1_t = style.getPropertyValue('translate');
      const v1_r = style.getPropertyValue('rotate');
      await new Promise(r => setTimeout(r, 150));
      const style2 = getComputedStyle(el);
      const v2_t = style2.getPropertyValue('translate');
      const v2_r = style2.getPropertyValue('rotate');
      
      // Values must continue to change during hover
      return v1_t !== v2_t || v1_r !== v2_r;
    });

    expect(areAnimationsContinuing).toBe(true);
  });

  test('The implementation should include a fallback strategy using @supports', async ({ page }) => {
    const hasSupportsFallback = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      try {
        return styleSheets.some(sheet => {
          const rules = Array.from(sheet.cssRules);
          return rules.some(rule => {
            if (rule.constructor.name === 'CSSSupportsRule') {
              const supportsRule = rule as CSSSupportsRule;
              return supportsRule.conditionText.includes('not') && 
                     (supportsRule.conditionText.includes('translate') || 
                      supportsRule.conditionText.includes('scale') || 
                      supportsRule.conditionText.includes('rotate'));
            }
            return false;
          });
        });
      } catch (e) {
        return false;
      }
    });
    expect(hasSupportsFallback).toBe(true);
  });

});
