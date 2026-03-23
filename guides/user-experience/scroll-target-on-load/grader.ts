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

test.describe(`scroll-target-on-load Expectations: ${demoName}`, () => {
  
  // Static Functional Tests
  
  test('Requirement: Ancestor scroll container with overflow: auto or scroll', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasOverflow = /overflow(-[yx])?\s*:\s*(auto|scroll)/i.test(html);
    expect(hasOverflow, 'The implementation MUST include an ancestor scroll container configured with scrolling (e.g., overflow: auto).').toBe(true);
  });

  test('Requirement: Target element with scroll-initial-target: nearest', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasProperty = /scroll-initial-target\s*:\s*nearest/i.test(html);
    expect(hasProperty, 'A specific target element MUST be defined and have the scroll-initial-target: nearest CSS property applied directly to it.').toBe(true);
  });

  test('Requirement: Exactly one target element with scroll-initial-target', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const matches = html.match(/scroll-initial-target\s*:\s*nearest/gi) || [];
    expect(matches.length, 'The scroll-initial-target property MUST be applied to the single target element within the container.').toBe(1);
  });

  test('Requirement: Explicit dimensions on media elements', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    const allHaveDimensions = imgTags.length > 0 && imgTags.every(img => {
        const hasWidth = /width\s*=\s*['"]?\d+%?['"]?/i.test(img) || /style\s*=\s*['"][^'"]*width\s*:/i.test(img);
        const hasHeight = /height\s*=\s*['"]?\d+%?['"]?/i.test(img) || /style\s*=\s*['"][^'"]*height\s*:/i.test(img);
        const hasAspectRatio = /style\s*=\s*['"][^'"]*aspect-ratio\s*:/i.test(img);
        return hasWidth && (hasHeight || hasAspectRatio);
    });
    expect(allHaveDimensions, 'Media elements (img) within the scroll container MUST have explicit dimensions applied (e.g., via height, width, or aspect-ratio).').toBe(true);
  });

  test('Requirement: JS fallback uses CSS.supports', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasSupportsCheck = /CSS\.supports\(\s*['"]scroll-initial-target['"]\s*,\s*['"]nearest['"]\s*\)/i.test(html);
    expect(hasSupportsCheck, 'A progressive enhancement JavaScript fallback MUST evaluate native CSS capability using CSS.supports before executing any scroll logic.').toBe(true);
  });

  test('Requirement: JS fallback uses behavior: instant', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasInstant = /scrollIntoView\(\s*{\s*([^}]*\s*)?behavior\s*:\s*['"]instant['"]/i.test(html);
    expect(hasInstant, 'Inside the fallback check, the script MUST scroll to the target element using behavior: "instant".').toBe(true);
  });

  test('Requirement: JS fallback executes no later than DOMContentLoaded', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const isLate = /window\.addEventListener\(\s*['"]load['"]/i.test(html) || /setTimeout/i.test(html);
    const usesDOMContentLoaded = /DOMContentLoaded/i.test(html);
    expect(usesDOMContentLoaded || !isLate, 'The fallback script MUST execute as soon as possible, no later than DOMContentLoaded.').toBe(true);
  });

  // Browser-based Tests
  
  test.describe('Browser Validation', () => {
    test.use({ viewport: { width: 800, height: 600 } });
    
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

      await page.goto(demoUrl, { waitUntil: 'load' });
    });

    test('Browser: Container is scrolled to target on load', async ({ page }) => {
      const scrollPos = await page.evaluate(() => {
        const target = document.querySelector('.target, #target, [style*="scroll-initial-target"]');
        if (!target) return 0;
        
        let container = target.parentElement;
        while (container && container !== document.documentElement) {
          const style = window.getComputedStyle(container);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') break;
          container = container.parentElement;
        }
        if (!container) container = document.documentElement;
        
        return container.scrollTop;
      });
      expect(scrollPos, 'The container should have a non-zero scroll position to bring the target into view.').toBeGreaterThan(0);
    });

    test('Browser: Target element is visible within container viewport', async ({ page }) => {
      const isVisible = await page.evaluate(() => {
        const target = document.querySelector('.target, #target, [style*="scroll-initial-target"]');
        if (!target) return false;
        
        let container = target.parentElement;
        while (container && container !== document.documentElement) {
          const style = window.getComputedStyle(container);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') break;
          container = container.parentElement;
        }
        if (!container) container = document.documentElement;
        
        const targetRect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Allow a small margin for error
        return targetRect.top >= containerRect.top - 10 && targetRect.bottom <= containerRect.bottom + 10;
      });
      expect(isVisible, 'The target element should be within the visible area of the scroll container.').toBe(true);
    });
  });
});
