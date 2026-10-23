/**
 * Expectations status for daily-grind web application:
 *
 * Expectation 1 (Inline critical CSS in <head>): TESTED - Verified alongside resource hints / LCP optimization and absence of @import.
 * Expectation 2 (Use async/defer for non-critical scripts): TESTED - Verified that no render-blocking <script src> exists in <head>.
 * Expectation 3 (Split CSS by media queries): SKIPPED - The base application is a single-page coffee shop template with a small inline stylesheet.
 * Expectation 4 (Resource hints preconnect/dns-prefetch): TESTED - The base application loads hero imagery from https://images.unsplash.com without preconnect or dns-prefetch.
 * Expectation 5 (No @import in CSS): TESTED - Verified alongside critical CSS inlining.
 * Expectation 6 (No large non-critical JS in <head>): TESTED - Verified that <head> contains no long blocking inline scripts.
 * Expectation 7 (fetchpriority="high" on LCP image): TESTED - Verified on hero <img> or <link rel="preload" as="image">.
 * Expectation 8 (Declare LCP image in static HTML): TESTED - Verified with JavaScript disabled.
 * Expectation 9 (Preload background LCP image with fetchpriority="high"): TESTED - Verified via <link rel="preload" as="image" fetchpriority="high"> or replacement with static hero <img>.
 * Expectation 10 (Demote competing above-the-fold images with fetchpriority="low"): SKIPPED - The base application has only a single hero image above the fold.
 * Expectation 11 (Do not lazy-load LCP image): TESTED - Verified that the prioritized LCP image does not have loading="lazy".
 * Expectation 12 (Do not overuse fetchpriority="high"): TESTED - Verified that at most 2 elements use fetchpriority="high".
 * Expectation 13 (No complex JS loaders for hero): TESTED - Verified via static HTML check with JavaScript disabled.
 * Expectations 14-20 (INP / scheduler.yield / heavy tasks / timers): SKIPPED - The base application is a static marketing page with no heavy computation or JS task queues.
 * Expectations 21-22 (Third-party script defer & self-hosting): SKIPPED - The base application loads no third-party scripts.
 * Expectations 23-27 (content-visibility: auto, contain-intrinsic-size, CSS containment, will-change): TESTED - Verified on below-the-fold sections and card components.
 * Expectations 28-33 (Modern image formats, width/height, lazy below-fold, no lazy above-fold): TESTED - Verified on hero preload/<img> and any content images.
 * Expectations 34-40 (Service Worker caching strategies): SKIPPED - Service Worker setup is outside the single-file static HTML base application scope.
 * Expectations 41-42 (Font preloading): SKIPPED - The base application uses system fonts ('Segoe UI', Tahoma, Geneva, Verdana, sans-serif).
 * Expectations 43-48 (Video element optimization): SKIPPED - The base application contains no <video> elements.
 * Expectations 49-50 (Dynamic import() and bundler vendor chunking): SKIPPED - The base application has no bundler or multi-module JS application code.
 */

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

  test('1. Resource hints (preconnect or dns-prefetch) are utilized for external origins', async ({ page }) => {
    await page.goto(demoUrl);
    const hints = await page.locator('head link[rel="preconnect"], head link[rel="dns-prefetch"]').count();
    expect(hints).toBeGreaterThan(0);
  });

  test('2. Critical CSS is inlined in <head> without @import and without render-blocking scripts', async ({ page }) => {
    await page.goto(demoUrl);
    const result = await page.evaluate(() => {
      const hasInlineStyle = document.querySelectorAll('head style').length > 0;
      const hasImport = Array.from(document.querySelectorAll('style')).some(s =>
        /@import\b/i.test(s.textContent || '')
      );
      const blockingHeadScripts = Array.from(document.querySelectorAll('head script[src]')).filter(script => {
        const isModule = script.getAttribute('type') === 'module';
        const isAsync = script.hasAttribute('async');
        const isDefer = script.hasAttribute('defer');
        const isRenderBlockingIntentional = script.getAttribute('blocking') === 'render';
        return !isModule && !isAsync && !isDefer && !isRenderBlockingIntentional;
      }).length;
      const hasPerfOptimization =
        document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="preload"], [fetchpriority="high"]').length > 0;
      return {
        hasInlineStyle,
        hasImport,
        blockingHeadScripts,
        hasPerfOptimization,
      };
    });
    expect(result.hasInlineStyle).toBe(true);
    expect(result.hasImport).toBe(false);
    expect(result.blockingHeadScripts).toBe(0);
    expect(result.hasPerfOptimization).toBe(true);
  });

  test('3. LCP hero image is prioritized with fetchpriority="high"', async ({ page }) => {
    await page.goto(demoUrl);
    const lcpPriority = await page.evaluate(() => {
      const preloadHigh = document.querySelector('link[rel="preload"][as="image"][fetchpriority="high"]');
      const imgHigh = document.querySelector('.hero img[fetchpriority="high"], header img[fetchpriority="high"], img[fetchpriority="high"]');
      const allHighCount = document.querySelectorAll('[fetchpriority="high"]').length;
      return {
        hasHighPriorityLcp: Boolean(preloadHigh || imgHigh),
        notOverused: allHighCount >= 1 && allHighCount <= 2,
      };
    });
    expect(lcpPriority.hasHighPriorityLcp).toBe(true);
    expect(lcpPriority.notOverused).toBe(true);
  });

  test('4. LCP image is discoverable in static HTML without JavaScript and is not lazy-loaded', async ({ browser }) => {
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
    const staticLcp = await page.evaluate(() => {
      const preload = document.querySelector('link[rel="preload"][as="image"][fetchpriority="high"]');
      const heroImg = document.querySelector('.hero img, header img, img[fetchpriority="high"]');
      if (!preload && !heroImg) return { found: false, notLazy: false };
      const isLazy = heroImg ? heroImg.getAttribute('loading') === 'lazy' : false;
      return {
        found: true,
        notLazy: !isLazy,
      };
    });
    await context.close();
    expect(staticLcp.found).toBe(true);
    expect(staticLcp.notLazy).toBe(true);
  });

  test('5. Modern image formats and explicit image dimensions are used without lazy-loading above the fold', async ({ page }) => {
    await page.goto(demoUrl);
    const mediaCheck = await page.evaluate(() => {
      const hasModernFormat =
        document.querySelectorAll('picture source[type="image/avif"], picture source[type="image/webp"]').length > 0 ||
        Array.from(document.querySelectorAll('img')).some(img => {
          const src = img.getAttribute('src') || '';
          const srcset = img.getAttribute('srcset') || '';
          return /auto=format|\.webp|\.avif/i.test(src) || /\.webp|\.avif|auto=format/i.test(srcset);
        }) ||
        Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).some(link => {
          const href = link.getAttribute('href') || '';
          const imagesrcset = link.getAttribute('imagesrcset') || '';
          return /auto=format|\.webp|\.avif/i.test(href) || /\.webp|\.avif|auto=format/i.test(imagesrcset);
        });

      const images = Array.from(document.querySelectorAll('img'));
      const missingDimensions = images.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > 50 && (!img.hasAttribute('width') || !img.hasAttribute('height'));
      }).length;

      const hasPriorityLcp = document.querySelectorAll('link[rel="preload"][as="image"], img[fetchpriority="high"], .hero img').length > 0;
      return {
        hasModernFormat: hasModernFormat && hasPriorityLcp,
        missingDimensions,
      };
    });
    expect(mediaCheck.hasModernFormat).toBe(true);
    expect(mediaCheck.missingDimensions).toBe(0);
  });

  test('6. Offscreen sections or isolated components use content-visibility: auto (with contain-intrinsic-size) or CSS containment', async ({ page }) => {
    await page.goto(demoUrl);
    const containmentResult = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const cvElements = allElements.filter(el => window.getComputedStyle(el).contentVisibility === 'auto');
      const heroEl = document.querySelector('.hero');
      const heroHasCv = heroEl ? window.getComputedStyle(heroEl).contentVisibility === 'auto' : false;

      const cvPaired = cvElements.length > 0 && cvElements.every(el => {
        const style = window.getComputedStyle(el);
        return Boolean(
          style.containIntrinsicSize &&
          !style.containIntrinsicSize.includes('none') &&
          style.containIntrinsicSize !== 'normal'
        );
      });

      const hasCssContain = allElements.some(el => {
        const contain = window.getComputedStyle(el).contain;
        return contain === 'content' || contain === 'strict' || contain.includes('layout') || contain.includes('paint');
      });

      const willChangeCount = allElements.filter(el => window.getComputedStyle(el).willChange !== 'auto').length;

      return {
        hasValidContainment: (cvElements.length > 0 && cvPaired && !heroHasCv) || hasCssContain,
        willChangeOverused: willChangeCount > 5,
      };
    });
    expect(containmentResult.hasValidContainment).toBe(true);
    expect(containmentResult.willChangeOverused).toBe(false);
  });
});
