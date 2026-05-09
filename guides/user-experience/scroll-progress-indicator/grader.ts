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

// Helper to reliably find the progress indicator element
async function findProgressElementHandle(page: any) {
  return page.evaluateHandle(() => {
    return new Promise((resolve) => {
      window.scrollTo(0, 0);
      setTimeout(() => {
        const starts = Array.from(document.querySelectorAll('*')).map(el => ({ el, w: el.getBoundingClientRect().width }));
        
        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        
        setTimeout(() => {
          requestAnimationFrame(() => {
            let maxDiff = 0;
            let bestEl = null;
            for (const s of starts) {
              const endW = s.el.getBoundingClientRect().width;
              if (endW - s.w > maxDiff) {
                maxDiff = endW - s.w;
                bestEl = s.el;
              }
            }
            // Scroll back up to not pollute other tests' state
            window.scrollTo(0, 0);
            
            if (bestEl && maxDiff > 10) {
              resolve(bestEl);
            } else {
              resolve(null); // Return null if not found
            }
          });
        }, 100);
      }, 50);
    });
  });
}

test.describe(`Scroll Progress Indicator Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    const TARGET_URL = `http://localhost/${demoName}`;
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(TARGET_URL);
  });

  test(`MANDATORY: The agent has defined an @keyframes block that animates transform: scaleX() from 0 to 1 (or similar scaling).`, async ({ page }) => {
    const handle = await findProgressElementHandle(page);

    const transformChanges = await handle.evaluate((el: Element | null) => {
      if (!el) return false;
      return new Promise<boolean>((resolve) => {
        window.scrollTo(0, 0);
        setTimeout(() => {
          const startTransform = window.getComputedStyle(el).transform;
          
          window.scrollTo(0, document.body.scrollHeight);
          setTimeout(() => {
            const endTransform = window.getComputedStyle(el).transform;
            window.scrollTo(0, 0); // Reset
            
            // It should change from matrix(0...) to matrix(1...) or similar
            resolve(startTransform !== endTransform && startTransform !== 'none' && endTransform !== 'none');
          }, 100);
        }, 50);
      });
    });

    expect(transformChanges).toBe(true);
  });

  test(`MANDATORY: The agent has applied the animation to the progress indicator element using animation-timeline: scroll().`, async ({ page }) => {
    const handle = await findProgressElementHandle(page);

    const hasTimeline = await handle.evaluate((el: any) => {
      if (!el) return false; const style = window.getComputedStyle(el) as any;
      return style.animationTimeline !== 'auto';
    });

    expect(hasTimeline).toBe(true);
  });

  test(`MANDATORY: The progress indicator element has position: fixed or position: absolute to stay in view.`, async ({ page }) => {
    const handle = await findProgressElementHandle(page);

    const isFixedOrAbsolute = await handle.evaluate((el: any) => {
      if (!el) return false; const style = window.getComputedStyle(el);
      return style.position === 'fixed' || style.position === 'absolute';
    });

    expect(isFixedOrAbsolute).toBe(true);
  });

  test(`MANDATORY: The progress indicator element has transform-origin set to the start (e.g., 0 50% or left) so it scales from the correct side.`, async ({ page }) => {
    const handle = await findProgressElementHandle(page);

    const hasCorrectOrigin = await handle.evaluate((el: any) => {
      if (!el) return false; const style = window.getComputedStyle(el);
      // transform-origin computes to px values, '0px 50%' for '0 50%' or 'left center'
      return style.transformOrigin.startsWith('0px');
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
             // Ignore cross-origin stylesheet errors
          } else {
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
             // Ignore cross-origin stylesheet errors
          } else {
             throw e;
          }
        }
      }
      return false;
    });
    expect(hasMedia).toBe(true);
  });

  test(`MANDATORY: The implementation DOES NOT add any scroll event listeners.`, async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    
    const { result } = await client.send('Runtime.evaluate', { expression: 'window' });
    const { listeners: windowListeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
    
    const { result: docResult } = await client.send('Runtime.evaluate', { expression: 'document' });
    const { listeners: docListeners } = await client.send('DOMDebugger.getEventListeners', { objectId: docResult.objectId! });
    
    const hasScrollListener = windowListeners.some(l => l.type === 'scroll') || docListeners.some(l => l.type === 'scroll');
    
    expect(hasScrollListener).toBe(false);
  });

});
