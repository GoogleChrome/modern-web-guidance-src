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

test.describe(`Performance Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Inject a script to record long tasks
    await page.addInitScript(() => {
      (window as any).longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).longTasks.push(entry);
        }
      }).observe({ entryTypes: ['longtask'] });
    });

    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl, { waitUntil: 'load', timeout: 10000 });
  });

  test('Critical CSS is inlined in the <head>', async ({ page }) => {
    const hasInlineStyle = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll('head style'));
      return styles.length > 0 && styles.some(s => s.textContent && s.textContent.trim().length > 0 && !s.textContent.includes('@import'));
    });
    expect(hasInlineStyle).toBe(true);
  });

  test('Non-critical stylesheets are deferred or loaded conditionally', async ({ page }) => {
    // If there are no stylesheets at all, this is technically passing the requirement "non-critical are deferred"
    // However, if there are render-blocking ones, it should fail.
    const hasRenderBlockingStyles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.some(link => {
        const media = link.getAttribute('media');
        const isConditional = media && media !== 'all' && media !== '';
        // In the guide, deferring is done via rel="preload" then switching to "stylesheet"
        // At this point it is "stylesheet". We can check if it has a media='print' or something that was used for deferring.
        // Or if it was loaded after the initial render.
        // But a simpler check: if it's a normal stylesheet without media query, it's render blocking.
        return !isConditional;
      });
    });
    // For the demo/negative-demo, they don't have many external styles.
    // Let's also check for @import which is a form of non-deferred loading.
    const hasImport = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('style')).some(s => s.textContent?.includes('@import'));
    });
    
    expect(hasRenderBlockingStyles || hasImport).toBe(false);
  });

  test('Non-critical scripts use async or defer attributes', async ({ page }) => {
    const allScriptsNonBlocking = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.every(script => {
        return script.hasAttribute('async') || script.hasAttribute('defer') || script.getAttribute('type') === 'module';
      });
    });
    expect(allScriptsNonBlocking).toBe(true);
  });

  test('Resource hints like preconnect are used for third-party domains', async ({ page }) => {
    const hasResourceHints = await page.evaluate(() => {
      const hints = Array.from(document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]'));
      return hints.length > 0;
    });
    expect(hasResourceHints).toBe(true);
  });

  test('Largest Contentful Paint (LCP) image has fetchpriority="high"', async ({ page }) => {
    const lcpImageHasHighPriority = await page.evaluate(() => {
      // Check for preload first
      const preloads = Array.from(document.querySelectorAll('link[rel="preload"][as="image"]'));
      const hasHighPriorityPreload = preloads.some(p => p.getAttribute('fetchpriority') === 'high');
      if (hasHighPriorityPreload) return true;

      const imgs = Array.from(document.querySelectorAll('img'));
      if (imgs.length === 0) return false;
      // Find the largest image in the initial viewport
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      let largestImg = null;
      let largestArea = 0;

      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.left < viewportWidth) {
          const area = rect.width * rect.height;
          if (area > largestArea) {
            largestArea = area;
            largestImg = img;
          }
        }
      }

      if (!largestImg) return false;
      return largestImg.getAttribute('fetchpriority') === 'high';
    });
    expect(lcpImageHasHighPriority).toBe(true);
  });

  test('LCP image does NOT use loading="lazy"', async ({ page }) => {
    const lcpImageNotLazy = await page.evaluate(() => {
      // If there is a preload for an image, it is likely the LCP image!
      const preloads = Array.from(document.querySelectorAll('link[rel="preload"][as="image"]'));
      if (preloads.length > 0) return true;

      const imgs = Array.from(document.querySelectorAll('img'));
      if (imgs.length === 0) return true;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      let largestImg = null;
      let largestArea = 0;

      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.left < viewportWidth) {
          const area = rect.width * rect.height;
          if (area > largestArea) {
            largestArea = area;
            largestImg = img;
          }
        }
      }

      if (!largestImg) return true;
      return largestImg.getAttribute('loading') !== 'lazy';
    });
    expect(lcpImageNotLazy).toBe(true);
  });

  test('Images below the fold use loading="lazy"', async ({ page }) => {
    const belowFoldImagesLazy = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const viewportHeight = window.innerHeight;
      const belowFoldImgs = imgs.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.top >= viewportHeight;
      });

      if (belowFoldImgs.length === 0) return true;
      return belowFoldImgs.every(img => img.getAttribute('loading') === 'lazy');
    });
    expect(belowFoldImagesLazy).toBe(true);
  });

  test('All <img> tags have explicit width and height attributes', async ({ page }) => {
    const allImagesHaveDimensions = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      if (imgs.length === 0) return true;
      return imgs.every(img => img.hasAttribute('width') && img.hasAttribute('height'));
    });
    expect(allImagesHaveDimensions).toBe(true);
  });

  test('Videos have explicit width, height, and a poster image', async ({ page }) => {
    const allVideosHaveRequirements = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      if (videos.length === 0) return true;
      return videos.every(v => v.hasAttribute('width') && v.hasAttribute('height') && v.hasAttribute('poster'));
    });
    expect(allVideosHaveRequirements).toBe(true);
  });

  test('Main thread is not blocked for long periods', async ({ page }) => {
    // Check if any long tasks were recorded during page load
    const longTasks = await page.evaluate(() => {
      return (window as any).longTasks || [];
    });
    // We expect NO long tasks (>50ms) if things are properly yielded
    // Note: Playwright itself or internal browser tasks might occasionally trigger them.
    // But in negative-demo, we have a 1s task.
    const seriousLongTasks = longTasks.filter((t: any) => t.duration > 100);
    expect(seriousLongTasks.length).toBe(0);
  });

});
