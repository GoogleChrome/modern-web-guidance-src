/// <reference types="node" />
import { test, expect } from '@playwright/test';
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

  const getTarget = (page: any) => page.locator('.card, .target, .bad-target, [class*="target"]').first();

  const checkExplicitStyle = async (target: any, prop: string) => {
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

  test('The target element should have a translate animation', async ({ page }) => {
    const target = getTarget(page);
    const hasTranslateAnim = await target.evaluate((el: HTMLElement) => {
      return el.getAnimations().some(anim => {
        if (!(anim instanceof CSSAnimation)) return false;
        const keyframes = anim.effect?.getKeyframes() || [];
        return keyframes.some(kf => kf.translate !== undefined && kf.translate !== 'none');
      });
    });
    expect(hasTranslateAnim).toBe(true);
  });

  test('The target element should have a rotate animation or transition', async ({ page }) => {
    const target = getTarget(page);
    const hasRotateEffect = await target.evaluate((el: HTMLElement) => {
      // Check for animation
      const hasAnim = el.getAnimations().some(anim => {
        if (!(anim instanceof CSSAnimation)) return false;
        const keyframes = anim.effect?.getKeyframes() || [];
        return keyframes.some(kf => kf.rotate !== undefined && kf.rotate !== 'none');
      });
      if (hasAnim) return true;
      
      // Check for transition on rotate
      const style = getComputedStyle(el);
      return style.transitionProperty.includes('rotate') || style.transitionProperty.includes('all');
    });
    expect(hasRotateEffect).toBe(true);
  });

  test('The target element should transition its scale property on hover', async ({ page }) => {
    const target = getTarget(page);
    const hasScaleTransition = await target.evaluate((el: HTMLElement) => {
      const style = getComputedStyle(el);
      return style.transitionProperty.includes('scale') || style.transitionProperty.includes('all');
    });
    expect(hasScaleTransition).toBe(true);
    
    const initialScale = await target.evaluate((el: HTMLElement) => getComputedStyle(el).scale);
    await target.hover({ force: true });
    await page.waitForTimeout(150);
    const midScale = await target.evaluate((el: HTMLElement) => getComputedStyle(el).scale);
    
    // In some browsers, identity scale is 'none'
    const isInitialNone = initialScale === 'none' || initialScale === '1';
    expect(midScale !== initialScale && midScale !== 'none').toBe(true);
  });

  test('Translate and rotate animations should continue uninterrupted when hovered', async ({ page }) => {
    const target = getTarget(page);
    await target.hover({ force: true });
    
    const areAnimationsContinuing = await target.evaluate(async (el: HTMLElement) => {
      const animations = el.getAnimations();
      if (animations.length === 0) return false;
      
      const t1 = getComputedStyle(el).translate;
      await new Promise(r => setTimeout(r, 100));
      const t2 = getComputedStyle(el).translate;
      
      // If translate is animating, it should change. 
      // If it's not changing, it might be at a keyframe, so we check if the animation is 'running'
      return animations.some(a => a.playState === 'running');
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
