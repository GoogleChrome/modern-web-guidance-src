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

test.describe(`Scroll Initial Target Expectations: ${demoName}`, () => {
  const html = fs.readFileSync(filePath, 'utf-8');

  // Functional/Static Analysis Tests
  test(`The target element MUST have the 'scroll-initial-target: nearest' CSS property applied`, async () => {
    // Check for the property in the source code (CSS or inline style)
    // Using a more specific regex to avoid matching text in <code> blocks
    expect(html).toMatch(/[\s{;]scroll-initial-target\s*:\s*nearest\s*[;}]/);
  });

  test(`Only a single target element should have the 'scroll-initial-target' property applied`, async () => {
    const matches = html.match(/[\s{;]scroll-initial-target\s*:\s*nearest\s*[;}]/g) || [];
    expect(matches.length).toBe(1);
  });

  test(`The progressive enhancement fallback MUST evaluate native CSS capability using 'CSS.supports'`, async () => {
    // Matches CSS.supports('scroll-initial-target', 'nearest') with single or double quotes
    expect(html).toMatch(/CSS\.supports\(\s*['"]scroll-initial-target['"]\s*,\s*['"]nearest['"]\s*\)/);
  });

  test(`The fallback script MUST execute no later than 'DOMContentLoaded'`, async () => {
    // Ensure DOMContentLoaded is used for early execution as per expectations
    expect(html).toMatch(/DOMContentLoaded/);
  });

  test(`The implementation MUST NOT use 'window.onload' for the scroll fallback`, async () => {
    // window.onload is too late and violates the "no later than DOMContentLoaded" rule
    expect(html).not.toMatch(/window\.onload/);
  });

  test(`The fallback script MUST use 'behavior: instant' for scrollIntoView`, async () => {
    // The fallback should mimic the discrete jump of the native property
    expect(html).toMatch(/scrollIntoView\(\s*\{\s*[^}]*behavior\s*:\s*['"]instant['"]/);
  });

  test(`The fallback script MUST NOT use 'behavior: smooth'`, async () => {
    // Smooth scrolling is specifically discouraged for this initial positioning task
    expect(html).not.toMatch(/behavior\s*:\s*['"]smooth['"]/);
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

  // Browser Assertions
  test(`The implementation MUST include an ancestor scroll container with overflow scrolling configured`, async ({ page }) => {
    const hasScrollContainer = await page.evaluate(() => {
      // Find the target element using typical identifiers used in the guides
      const target = document.querySelector('.target, [style*="scroll-initial-target"], #target');
      if (!target) return false;

      let parent = target.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        const hasOverflow = (val: string) => val === 'auto' || val === 'scroll';
        if (hasOverflow(style.overflow) || hasOverflow(style.overflowY) || hasOverflow(style.overflowX)) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    });
    expect(hasScrollContainer).toBe(true);
  });

  test(`Media elements within the scroll container MUST have explicit dimensions applied`, async ({ page }) => {
    const mediaHaveDimensions = await page.evaluate(() => {
      const target = document.querySelector('.target, [style*="scroll-initial-target"], #target');
      if (!target) return false;

      // Identify the scroll container
      let container: HTMLElement | null = target.parentElement;
      while (container) {
        const style = window.getComputedStyle(container);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
        container = container.parentElement;
      }

      const searchRoot = container || document.body;
      const images = searchRoot.querySelectorAll('img');
      
      if (images.length === 0) return true;

      return Array.from(images).every(img => {
        // Check for width and height attributes or explicit inline styles
        const hasWidth = img.hasAttribute('width') || (img.style.width && img.style.width !== 'auto');
        const hasHeight = img.hasAttribute('height') || (img.style.height && img.style.height !== 'auto');
        const style = window.getComputedStyle(img);
        const hasAspectRatio = style.aspectRatio !== 'auto';
        
        // Explicit dimensions require width AND (height OR aspect-ratio)
        return hasWidth && (hasHeight || hasAspectRatio);
      });
    });
    expect(mediaHaveDimensions).toBe(true);
  });
});
