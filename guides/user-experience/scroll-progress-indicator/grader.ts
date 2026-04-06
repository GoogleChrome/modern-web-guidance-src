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

test.describe(`Scroll Progress Indicator Expectations: ${demoName}`, () => {

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

  test(`MANDATORY: The agent has defined an @keyframes block that animates transform: scaleX() from 0 to 1 (or similar scaling).`, async ({ page }) => {
    const hasTransformScaleX = await page.evaluate(() => {
      function checkRules(rules: any): boolean {
        for (const rule of rules) {
          if (rule instanceof CSSKeyframesRule) {
             let hasScale0 = false;
             let hasScale1 = false;
             for (let i = 0; i < rule.cssRules.length; i++) {
               const kf = rule.cssRules[i] as CSSKeyframeRule;
               if (kf.style) {
                 const transform = kf.style.transform || kf.style.getPropertyValue('transform') || kf.cssText;
                 if (transform.includes('scaleX(0)') || transform.includes('scale(0') || transform.includes('scale3d(0')) hasScale0 = true;
                 if (transform.includes('scaleX(1)') || transform.includes('scale(1') || transform.includes('scale3d(1')) hasScale1 = true;
               }
             }
             if (hasScale0 && hasScale1) return true;
          }
          if (rule.cssRules) {
            if (checkRules(rule.cssRules)) return true;
          }
        }
        return false;
      }
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          if (checkRules(document.styleSheets[i].cssRules)) return true;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
             throw e;
          }
        }
      }
      return false;
    });
    expect(hasTransformScaleX).toBe(true);
  });

  test(`MANDATORY: The agent has applied the animation to the progress indicator element using animation-timeline: scroll().`, async ({ page }) => {
    const hasTimeline = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const comp = window.getComputedStyle(el);
        if (comp.animationTimeline && comp.animationTimeline !== 'auto' && comp.animationName !== 'none') {
          return true;
        }
      }
      return false;
    });
    expect(hasTimeline).toBe(true);
  });

  test(`MANDATORY: The progress indicator element has position: fixed or position: absolute to stay in view.`, async ({ page }) => {
    const isFixedOrAbsolute = await page.evaluate(() => {
      const progressElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const comp = window.getComputedStyle(el);
        return comp.animationName !== 'none' && (comp.animationTimeline !== 'auto' || el.id.includes('progress') || comp.animationName.includes('progress'));
      });
      
      if (progressElements.length === 0) return false;
      return progressElements.some(el => {
        const comp = window.getComputedStyle(el);
        return comp.position === 'fixed' || comp.position === 'absolute';
      });
    });
    expect(isFixedOrAbsolute).toBe(true);
  });

  test(`MANDATORY: The progress indicator element has transform-origin set to the start (e.g., 0 50% or left) so it scales from the correct side.`, async ({ page }) => {
    const hasCorrectOrigin = await page.evaluate(() => {
      const progressElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const comp = window.getComputedStyle(el);
        return comp.animationName !== 'none' && (comp.animationTimeline !== 'auto' || el.id.includes('progress') || comp.animationName.includes('progress'));
      });
      
      if (progressElements.length === 0) return false;
      return progressElements.some(el => {
        const comp = window.getComputedStyle(el);
        return comp.transformOrigin.startsWith('0px') || comp.transformOrigin.startsWith('left');
      });
    });
    expect(hasCorrectOrigin).toBe(true);
  });

  test(`MANDATORY: The implementation includes feature detection using @supports for scroll-driven animations.`, async ({ page }) => {
    const hasSupports = await page.evaluate(() => {
      function checkRules(rules: any): boolean {
        for (const rule of rules) {
          if (rule instanceof CSSSupportsRule && rule.conditionText.includes('animation-timeline')) {
            return true;
          }
          if (rule.cssRules) {
            if (checkRules(rule.cssRules)) return true;
          }
        }
        return false;
      }
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          if (checkRules(document.styleSheets[i].cssRules)) return true;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
             throw e;
          }
        }
      }
      return false;
    });
    expect(hasSupports).toBe(true);
  });

  test(`MANDATORY: The implementation respects user preferences for reduced motion using @media (prefers-reduced-motion: no-preference).`, async ({ page }) => {
    const hasMedia = await page.evaluate(() => {
      function checkRules(rules: any): boolean {
        for (const rule of rules) {
          if (rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion')) {
            return true;
          }
          if (rule.cssRules) {
            if (checkRules(rule.cssRules)) return true;
          }
        }
        return false;
      }
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          if (checkRules(document.styleSheets[i].cssRules)) return true;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
             throw e;
          }
        }
      }
      return false;
    });
    expect(hasMedia).toBe(true);
  });

});
