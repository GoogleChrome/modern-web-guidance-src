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

// Tests
test.describe(`Pull-to-Reveal Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Fallback script MUST evaluate native CSS capability using !CSS.supports`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasSupportsCheck = 
      html.includes('!CSS.supports("scroll-initial-target", "nearest")') || 
      html.includes("!CSS.supports('scroll-initial-target', 'nearest')") ||
      html.includes('!CSS.supports(`scroll-initial-target`, `nearest`)');
    expect(hasSupportsCheck).toBe(true);
  });

  test(`Fallback script MUST execute no later than DOMContentLoaded`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasDOMContentLoaded = html.includes('DOMContentLoaded');
    const hasWindowLoad = html.includes('load') && (html.includes('window.addEventListener') || html.includes('window.onload'));
    
    // It should have DOMContentLoaded and not use window load event
    expect(hasDOMContentLoaded && !hasWindowLoad).toBe(true);
  });

  test(`Fallback script MUST use behavior: 'instant' and block: 'start' for scrollIntoView`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasInstantScroll = html.includes("behavior: 'instant'") || html.includes('behavior: "instant"');
    const hasBlockStart = html.includes("block: 'start'") || html.includes('block: "start"');
    
    expect(hasInstantScroll && hasBlockStart).toBe(true);
  });

  test(`Implementation MUST NOT rely on JavaScript as its primary mechanism`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    
    // The scrollIntoView should be guarded by the CSS.supports check
    const supportsMatch = html.match(/!CSS\.supports\(\s*["'`]scroll-initial-target["'`]\s*,\s*["'`]nearest["'`]\s*\)/);
    const scrollIndex = html.indexOf('scrollIntoView');
    
    // It only relies on JS as fallback if scrollIntoView is inside/after the CSS support check
    const isFallbackOnly = !!(supportsMatch && scrollIndex > supportsMatch.index);
    expect(isFallbackOnly).toBe(true);
  });

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

  // Browser assertions
  test(`Ancestor scroll container must have overflow-y and mandatory scroll-snap-type`, async ({ page }) => {
    const hasValidContainer = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
        const isMandatorySnap = style.scrollSnapType.includes('mandatory');
        return isScrollable && isMandatorySnap;
      });
    });
    expect(hasValidContainer).toBe(true);
  });

  test(`First descendant in scroll container must have scroll-snap-align: start`, async ({ page }) => {
    const hasValidFirstChild = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.overflowY === 'auto' || style.overflowY === 'scroll';
      });
      if (containers.length === 0) return false;
      
      const firstChild = containers[0].firstElementChild;
      if (!firstChild) return false;
      
      const childStyle = window.getComputedStyle(firstChild);
      return childStyle.scrollSnapAlign.includes('start');
    });
    expect(hasValidFirstChild).toBe(true);
  });

  test(`Main content element must have scroll-snap-align: start and scroll-initial-target: nearest`, async ({ page }) => {
    const hasValidMainContent = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.overflowY === 'auto' || style.overflowY === 'scroll';
      });
      if (containers.length === 0) return false;
      
      const container = containers[0];
      if (container.children.length < 2) return false;
      
      const mainContent = container.children[1];
      const mainContentStyle = window.getComputedStyle(mainContent);
      
      // Check for scroll-snap-align: start
      const hasSnapStart = mainContentStyle.scrollSnapAlign.includes('start');
      
      // Check for scroll-initial-target in applied CSS rules
      let hasInitialTarget = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && mainContent.matches(rule.selectorText)) {
              if (rule.style.getPropertyValue('scroll-initial-target') === 'nearest' || rule.cssText.includes('scroll-initial-target: nearest')) {
                hasInitialTarget = true;
              }
            }
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
            continue;
          }
          throw e;
        }
      }
      
      return hasSnapStart && hasInitialTarget;
    });
    expect(hasValidMainContent).toBe(true);
  });

  test(`scroll-initial-target property MUST be applied to only one element within the scroll container`, async ({ page }) => {
    const elementsWithInitialTargetCount = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.overflowY === 'auto' || style.overflowY === 'scroll';
      });
      if (containers.length === 0) return 0;
      
      const container = containers[0];
      let count = 0;
      const elements = Array.from(container.querySelectorAll('*'));
      
      for (const el of elements) {
        let hasProp = false;
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
                if (rule.style.getPropertyValue('scroll-initial-target') === 'nearest' || rule.cssText.includes('scroll-initial-target: nearest')) {
                  hasProp = true;
                }
              }
            }
          } catch (e) {
            if (e instanceof DOMException && e.name === 'SecurityError') {
              continue;
            }
            throw e;
          }
        }
        if (hasProp) {
          count++;
        }
      }
      return count;
    });
    
    expect(elementsWithInitialTargetCount).toBe(1);
  });
});
