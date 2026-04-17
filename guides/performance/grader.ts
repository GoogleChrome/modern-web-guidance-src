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

test.describe(`Performance Optimization Expectations: ${demoName}`, () => {
  // Setup browser testing route
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
  });

  // 1. Critical Rendering Path
  test('Critical CSS is inlined and external CSS is deferred', async ({ page }) => {
    await page.goto(demoUrl);
    const result = await page.evaluate(() => {
      const hasStyle = document.querySelectorAll('head style').length > 0;
      const blockingLinks = Array.from(document.querySelectorAll('head link[rel="stylesheet"]')).filter(link => {
        const media = link.getAttribute('media');
        return (!media || media === '' || media === 'all') && !link.hasAttribute('onload');
      }).length;
      return hasStyle && blockingLinks === 0;
    });
    expect(result).toBe(true);
  });

  test('Inlined CSS does not use @import', async ({ page }) => {
    await page.goto(demoUrl);
    const hasImport = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('style')).some(s => s.textContent?.includes('@import'));
    });
    expect(hasImport).toBe(false);
  });

  test('Non-critical scripts in the head use async or defer', async ({ page }) => {
    await page.goto(demoUrl);
    const blockingScripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('head script[src]')).filter(script => {
        const isModule = script.getAttribute('type') === 'module';
        const isAsync = script.hasAttribute('async');
        const isDefer = script.hasAttribute('defer');
        return !isModule && !isAsync && !isDefer;
      }).length;
    });
    expect(blockingScripts).toBe(0);
  });

  test('Resource hints (preconnect or dns-prefetch) are utilized', async ({ page }) => {
    await page.goto(demoUrl);
    const hints = await page.locator('link[rel="preconnect"], link[rel="dns-prefetch"]').count();
    expect(hints).toBeGreaterThan(0);
  });

  // 2. LCP Optimization
  test('LCP image is prioritized correctly (high priority, not lazy)', async ({ page }) => {
    await page.goto(demoUrl);
    const result = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      if (images.length === 0) return false;
      
      const inViewport = images.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0;
      });
      if (inViewport.length === 0) return false;
      
      const largest = inViewport.reduce((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return (rectA.width * rectA.height > rectB.width * rectB.height) ? a : b;
      });
      
      const isHigh = largest.getAttribute('fetchpriority') === 'high';
      const isNotLazy = largest.getAttribute('loading') !== 'lazy';
      return isHigh && isNotLazy;
    });
    expect(result).toBe(true);
  });

  test('LCP image is declared in static HTML for early discovery', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/<img[^>]+fetchpriority=["']high["']/);
  });

  test('Competing above-the-fold elements are demoted', async ({ page }) => {
    await page.goto(demoUrl);
    const result = await page.evaluate(() => {
      const lowPriority = Array.from(document.querySelectorAll('[fetchpriority="low"]'));
      if (lowPriority.length === 0) return false;

      const images = Array.from(document.querySelectorAll('img'));
      if (images.length === 0) return true;

      const largest = images.reduce((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return (rectA.width * rectA.height > rectB.width * rectB.height) ? a : b;
      });

      return lowPriority.every(el => el !== largest);
    });
    expect(result).toBe(true);
  });

  // 3. INP & Main Thread
  test('Main thread tasks are broken up with scheduler.yield() or fallback', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    
    // Check HTML
    let usesYield = html.includes('scheduler.yield') || (html.includes('setTimeout') && html.includes('Promise'));
    
    // Check all JS files in target dir
    const files = fs.readdirSync(targetDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const jsContent = fs.readFileSync(path.join(targetDir, file), 'utf-8');
        if (jsContent.includes('scheduler.yield') || (jsContent.includes('setTimeout') && jsContent.includes('Promise'))) {
          usesYield = true;
          break;
        }
      }
    }
    
    const avoidsBlockingLoop = !html.includes('while (Date.now() - start < 300)');
    expect(usesYield && avoidsBlockingLoop).toBe(true);
  });

  // 4. CSS Containment
  test('Content-visibility is used appropriately (not on above-the-fold content)', async ({ page }) => {
    await page.goto(demoUrl);
    const result = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*')).filter(el => {
        return window.getComputedStyle(el).contentVisibility === 'auto';
      });
      if (elements.length === 0) return false;
      
      const anyAboveFold = elements.some(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      });
      return !anyAboveFold;
    });
    expect(result).toBe(true);
  });

  test('will-change is not overused globally', async ({ page }) => {
    await page.goto(demoUrl);
    const overused = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let count = 0;
      for (const el of allElements) {
        if (window.getComputedStyle(el).willChange !== 'auto') {
          count++;
        }
      }
      return count > 5;
    });
    expect(overused).toBe(false);
  });

  // 5. Images & Media
  test('Modern image formats (AVIF/WebP) are served via picture element', async ({ page }) => {
    await page.goto(demoUrl);
    const pictureCount = await page.locator('picture source[type="image/avif"], picture source[type="image/webp"]').count();
    expect(pictureCount).toBeGreaterThan(0);
  });

  test('Images have explicit width and height attributes', async ({ page }) => {
    await page.goto(demoUrl);
    const missingDimensions = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > 50 && (!img.hasAttribute('width') || !img.hasAttribute('height'));
      }).length;
    });
    expect(missingDimensions).toBe(0); 
  });

  test('Below-the-fold images are lazy-loaded', async ({ page }) => {
    await page.goto(demoUrl);
    const belowFoldNotLazy = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.top > window.innerHeight && img.getAttribute('loading') !== 'lazy';
      }).length;
    });
    expect(belowFoldNotLazy).toBe(0);
  });

  test('Videos are optimized with dimensions, poster, and deferred preloading', async ({ page }) => {
    await page.goto(demoUrl);
    const result = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return true; // Pass if no video found
      const hasDimensions = video.hasAttribute('width') && video.hasAttribute('height');
      const hasPoster = video.hasAttribute('poster');
      const isPreloadNone = video.getAttribute('preload') === 'none';
      return hasDimensions && hasPoster && isPreloadNone;
    });
    expect(result).toBe(true);
  });

  // 6. Service Worker
  test('Implementation MUST register a Service Worker', async ({ page }) => {
    await page.goto(demoUrl);
    // Wait for SW to be registered
    const isRegistered = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(isRegistered).toBe(true);
  });

  test('Service Worker MUST create expected caches', async ({ page }) => {
    await page.goto(demoUrl);
    // Wait for SW to install and create caches
    const hasCaches = await page.evaluate(async () => {
      // Poll for caches keys to be non-empty
      for (let i = 0; i < 10; i++) {
        const keys = await caches.keys();
        if (keys.length > 0) return true;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return false;
    });
    expect(hasCaches).toBe(true);
  });

  // 7. Code Splitting
  test('Implementation MUST use dynamic imports to load code on demand', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    let hasDynamicImport = html.includes('import(');
    
    // Also check JS files
    const files = fs.readdirSync(targetDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const jsContent = fs.readFileSync(path.join(targetDir, file), 'utf-8');
        if (jsContent.includes('import(')) {
          hasDynamicImport = true;
          break;
        }
      }
    }
    expect(hasDynamicImport).toBe(true);
  });
});
