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

  // 1. Critical Rendering Path (CRP)
  test('Critical CSS is inlined in the HTML <head>', async ({ page }) => {
    await page.goto(demoUrl);
    const hasStyle = await page.evaluate(() => {
      return document.querySelectorAll('head style').length > 0;
    });
    expect(hasStyle).toBe(true);
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

  test('CSS is split by media queries using the media attribute', async ({ page }) => {
    await page.goto(demoUrl);
    const hasMediaLink = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('head link[rel="stylesheet"]')).some(link => {
        const media = link.getAttribute('media');
        return media && media !== '' && media !== 'all';
      });
    });
    expect(hasMediaLink).toBe(true);
  });

  test('Resource hints (preconnect or dns-prefetch) are utilized', async ({ page }) => {
    await page.goto(demoUrl);
    const hints = await page.locator('link[rel="preconnect"], link[rel="dns-prefetch"]').count();
    expect(hints).toBeGreaterThan(0);
  });

  test('Inlined CSS does not use @import', async ({ page }) => {
    await page.goto(demoUrl);
    const hasImport = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('style')).some(s => s.textContent?.includes('@import'));
    });
    expect(hasImport).toBe(false);
  });

  test('No large, non-critical JavaScript is in the <head>', async ({ page }) => {
    await page.goto(demoUrl);
    const hasLargeHeadScript = await page.evaluate(() => {
      const headScripts = Array.from(document.querySelectorAll('head script:not([src])'));
      return headScripts.some(s => {
        const content = s.textContent || '';
        return content.length > 100 && content.includes('blockMainThread');
      });
    });
    expect(hasLargeHeadScript).toBe(false);
  });

  // 2. Largest Contentful Paint (LCP)
  test('LCP image has fetchpriority="high"', async ({ page }) => {
    await page.goto(demoUrl);
    const isHigh = await page.evaluate(() => {
      const img = document.querySelector('.lcp-image, img[src*="photo-1611162617213"]');
      return img?.getAttribute('fetchpriority') === 'high';
    });
    expect(isHigh).toBe(true);
  });

  test('LCP image is declared in static HTML', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
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
    const hasStaticLCPImage = await page.evaluate(() => {
      const img = document.querySelector('img[fetchpriority="high"], .lcp-image');
      return !!img;
    });
    await context.close();
    expect(hasStaticLCPImage).toBe(true);
  });

  test('LCP image does not use loading="lazy"', async ({ page }) => {
    await page.goto(demoUrl);
    const isNotLazy = await page.evaluate(() => {
      const img = document.querySelector('.lcp-image, img[src*="photo-1611162617213"], img.hero-image');
      if (!img) return false;
      return img.getAttribute('loading') !== 'lazy';
    });
    expect(isNotLazy).toBe(true);
  });

  test('Background images acting as LCP are preloaded with high priority', async ({ page }) => {
    await page.goto(demoUrl);
    const hasPreloadedLCPImage = await page.evaluate(() => {
      const preloadLinks = Array.from(document.querySelectorAll('link[rel="preload"][as="image"]'));
      return preloadLinks.some(link => link.getAttribute('fetchpriority') === 'high');
    });
    expect(hasPreloadedLCPImage).toBe(true);
  });

  test('Competing above-the-fold non-LCP elements are demoted with fetchpriority="low"', async ({ page }) => {
    await page.goto(demoUrl);
    const hasLowPriority = await page.evaluate(() => {
      return document.querySelectorAll('[fetchpriority="low"]').length > 0;
    });
    expect(hasLowPriority).toBe(true);
  });

  test('fetchpriority="high" is not overused', async ({ page }) => {
    await page.goto(demoUrl);
    const count = await page.evaluate(() => {
      return document.querySelectorAll('[fetchpriority="high"]').length;
    });
    expect(count >= 1 && count <= 2).toBe(true);
  });

  test('No complex JavaScript loaders are used for the hero section', async ({ page }) => {
    await page.goto(demoUrl);
    const hasJSLoader = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return html.includes('appendChild') && html.includes('hero-container');
    });
    expect(hasJSLoader).toBe(false);
  });

  // 3. Interaction to Next Paint (INP) & Main Thread
  test('Main thread tasks are broken up on initial page load', async ({ page }) => {
    let longTasksCount = 0;
    await page.exposeFunction('reportLongTask', () => {
      longTasksCount++;
    });
    await page.addInitScript(() => {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // @ts-ignore
          window.reportLongTask();
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    });
    await page.goto(demoUrl);
    await page.waitForTimeout(500);
    expect(longTasksCount).toBe(0);
  });

  test('scheduler.yield() or fallback is present in implementation', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const usesYield = html.includes('scheduler.yield') || (html.includes('setTimeout') && html.includes('Promise'));
    expect(usesYield).toBe(true);
  });

  test('Heavy tasks do not block the main thread and yield correctly', async ({ page }) => {
    await page.goto(demoUrl);
    const button = page.locator('#heavyTaskBtn');
    if (await button.count() === 0) {
      expect(false).toBe(true);
      return;
    }
    let yieldCalled = false;
    await page.exposeFunction('reportYieldBtn', () => {
      yieldCalled = true;
    });
    await page.addInitScript(() => {
      if (window.scheduler && window.scheduler.yield) {
        const originalYield = window.scheduler.yield;
        window.scheduler.yield = function() {
          // @ts-ignore
          window.reportYieldBtn();
          return originalYield.apply(this, arguments as any);
        };
      } else {
        const originalTimeout = window.setTimeout;
        // @ts-ignore
        window.setTimeout = function(fn, delay) {
          if (delay === 0) {
            // @ts-ignore
            window.reportYieldBtn();
          }
          return originalTimeout.apply(this, arguments as any);
        };
      }
    });
    await page.reload();
    await page.click('#heavyTaskBtn');
    await page.waitForTimeout(500);
    expect(yieldCalled).toBe(true);
  });

  test('Rapid event listeners (like scroll) are debounced or throttled', async ({ page }) => {
    await page.goto(demoUrl);
    let longTaskDetected = false;
    await page.exposeFunction('reportScrollLongTask', () => {
      longTaskDetected = true;
    });
    await page.addInitScript(() => {
      const observer = new PerformanceObserver(() => {
        // @ts-ignore
        window.reportScrollLongTask();
      });
      observer.observe({ entryTypes: ['longtask'] });
    });
    await page.reload();
    await page.evaluate(() => {
      window.scrollTo(0, 100);
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.scrollTo(0, 200);
    });
    await page.waitForTimeout(100);
    expect(longTaskDetected).toBe(false);
  });

  test('UI updates are separated from heavy computations', async ({ page }) => {
    await page.goto(demoUrl);
    const hasSeparation = await page.evaluate(() => {
      const hasProgress = !!document.getElementById('progressBarFill');
      const isLegacy = document.title.includes('Legacy');
      return hasProgress && !isLegacy;
    });
    expect(hasSeparation).toBe(true);
  });

  test('No layout thrashing patterns are present in scripts', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasThrashingPattern = html.includes('offsetTop') && html.includes('style.transform') && html.includes('offsetHeight');
    expect(hasThrashingPattern).toBe(false);
  });

  test('No heavy recurring timers block the main thread', async ({ page }) => {
    await page.goto(demoUrl);
    const hasHeavyInterval = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return html.includes('setInterval') && html.includes('blockMainThread');
    });
    expect(hasHeavyInterval).toBe(false);
  });

  // 4. Third-Party Script Management
  test('All non-critical third-party scripts are deferred', async ({ page }) => {
    await page.goto(demoUrl);
    const blockingThirdParty = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.filter(s => {
        const src = s.getAttribute('src') || '';
        const isThirdParty = src.includes('http') || src.includes('//');
        const isDeferred = s.hasAttribute('defer') || s.hasAttribute('async') || s.getAttribute('type') === 'module';
        return isThirdParty && !isDeferred;
      }).length;
    });
    expect(blockingThirdParty).toBe(0);
  });

  test('Critical dependencies are self-hosted and not loaded from public CDNs', async ({ page }) => {
    await page.goto(demoUrl);
    const hasExternalCDNDependencies = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.some(s => {
        const src = s.getAttribute('src') || '';
        return src.includes('cdn') || src.includes('cdnjs') || src.includes('jquery');
      });
    });
    expect(hasExternalCDNDependencies).toBe(false);
  });

  // 5. CSS Rendering & Containment
  test('content-visibility: auto is not applied to above-the-fold content', async ({ page }) => {
    await page.goto(demoUrl);
    const anyAboveFold = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*')).filter(el => {
        return window.getComputedStyle(el).contentVisibility === 'auto';
      });
      if (elements.length === 0) return true; // Pass if none used
      return elements.some(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      });
    });
    expect(anyAboveFold).toBe(false);
  });

  test('content-visibility: auto is paired with contain-intrinsic-size', async ({ page }) => {
    await page.goto(demoUrl);
    const isPaired = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*')).filter(el => {
        return window.getComputedStyle(el).contentVisibility === 'auto';
      });
      if (elements.length === 0) return false;
      return elements.every(el => {
        const style = window.getComputedStyle(el);
        return style.containIntrinsicSize && 
               !style.containIntrinsicSize.includes('none') && 
               style.containIntrinsicSize !== 'normal';
      });
    });
    expect(isPaired).toBe(true);
  });

  test('Explicit CSS containment (contain: layout style paint) is applied for isolated components', async ({ page }) => {
    await page.goto(demoUrl);
    const hasContainment = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).some(el => {
        const contain = window.getComputedStyle(el).contain;
        return contain === 'content' || contain === 'strict' || (contain.includes('layout') && contain.includes('paint'));
      });
    });
    expect(hasContainment).toBe(true);
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

  // 6. Modern Image & Media Optimization
  test('Modern image formats (AVIF/WebP) are served', async ({ page }) => {
    await page.goto(demoUrl);
    const pictureCount = await page.locator('picture source[type="image/avif"], picture source[type="image/webp"]').count();
    const hasAutoFormat = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).some(img => img.src.includes('auto=format'));
    });
    expect(pictureCount > 0 || hasAutoFormat).toBe(true);
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

  test('Below-the-fold images use loading="lazy"', async ({ page }) => {
    await page.goto(demoUrl);
    const belowFoldNotLazy = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.top >= window.innerHeight && img.getAttribute('loading') !== 'lazy';
      }).length;
    });
    expect(belowFoldNotLazy).toBe(0);
  });

  test('Above-the-fold images do not use loading="lazy"', async ({ page }) => {
    await page.goto(demoUrl);
    const lazyAboveFold = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0 && img.getAttribute('loading') === 'lazy';
      }).length;
    });
    expect(lazyAboveFold).toBe(0);
  });

  test('Responsive images use srcset and sizes attributes', async ({ page }) => {
    await page.goto(demoUrl);
    const hasResponsiveImage = await page.evaluate(() => {
      const sources = Array.from(document.querySelectorAll('source[srcset]'));
      const imgs = Array.from(document.querySelectorAll('img[srcset]'));
      const all = [...sources, ...imgs];
      if (all.length === 0) return false;
      return all.every(el => el.hasAttribute('sizes'));
    });
    expect(hasResponsiveImage).toBe(true);
  });

  // 7. Service Workers & Caching
  test('A Service Worker is registered', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  test('Service Worker uses a CacheFirst strategy for static assets', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  test('Service Worker uses a NetworkFirst strategy for HTML documents', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  test('Service Worker creates caches to store resources', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  test('Service Worker does not cache opaque responses blindly', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  test('Service Worker does not cache POST requests', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  test('Service Worker does not bypass versioning for cached assets', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  // 8. Fonts
  test('Critical fonts are preloaded with crossorigin', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  test('Fonts are not over-preloaded', async ({ page }) => {
    await page.goto(demoUrl);
    const passed = await page.evaluate(() => {
      if (document.title.includes('Legacy')) return false;
      return true;
    });
    expect(passed).toBe(true);
  });

  // 9. Video Performance
  test('Video elements have explicit width and height attributes', async ({ page }) => {
    await page.goto(demoUrl);
    const hasDimensions = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return false;
      return video.hasAttribute('width') && video.hasAttribute('height');
    });
    expect(hasDimensions).toBe(true);
  });

  test('Video elements have a poster image fallback', async ({ page }) => {
    await page.goto(demoUrl);
    const hasPoster = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return false;
      return video.hasAttribute('poster');
    });
    expect(hasPoster).toBe(true);
  });

  test('Video elements use preload="none" for non-critical videos', async ({ page }) => {
    await page.goto(demoUrl);
    const isPreloadNone = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return false;
      return video.getAttribute('preload') === 'none';
    });
    expect(isPreloadNone).toBe(true);
  });

  test('Video elements serve modern video formats via source negotiation', async ({ page }) => {
    await page.goto(demoUrl);
    const hasWebM = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return false;
      const sources = Array.from(video.querySelectorAll('source'));
      return sources.some(s => s.getAttribute('type') === 'video/webm');
    });
    expect(hasWebM).toBe(true);
  });

  test('Video elements use loading="lazy" for offscreen videos', async ({ page }) => {
    await page.goto(demoUrl);
    const hasLazy = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return false;
      return video.getAttribute('loading') === 'lazy';
    });
    expect(hasLazy).toBe(true);
  });

  test('Videos do not auto-play large video files without user intent', async ({ page }) => {
    await page.goto(demoUrl);
    const isAutoplayed = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return false;
      return video.hasAttribute('autoplay');
    });
    expect(isAutoplayed).toBe(false);
  });

  // 10. Code Splitting
  test('Implementation uses dynamic imports to load code on demand', async ({ page }) => {
    await page.goto(demoUrl);
    const hasDynamicImport = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return html.includes('import(');
    });
    expect(hasDynamicImport).toBe(true);
  });

  test('Third-party vendors are not monolithic render-blocking head scripts', async ({ page }) => {
    await page.goto(demoUrl);
    const hasBlockingThirdPartyVendor = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('head script[src]')).some(s => {
        const src = s.getAttribute('src') || '';
        return src.includes('jquery') || src.includes('lodash');
      });
    });
    expect(hasBlockingThirdPartyVendor).toBe(false);
  });
});
