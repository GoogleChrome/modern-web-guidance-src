import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE ? path.resolve(process.env.TARGET_FILE) : path.join(import.meta.dirname, 'demo.html');
const targetDir = path.dirname(targetFile);
const targetFileName = path.basename(targetFile);
const targetUrl = `http://localhost/${targetFileName}`;

test.describe('Soft Edge Content Fade Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const reqPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = reqPath === '/' ? targetFileName : reqPath.replace(/^\/+/, '');
      const resolved = path.resolve(targetDir, relPath);
      if (resolved.startsWith(targetDir + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        await route.fulfill({ path: resolved });
      } else {
        await route.continue();
      }
    });
    await page.goto(targetUrl);
  });

  test('the element with class .paywall-container has the mask-image property applied with a linear-gradient', async ({ page }) => {
    const maskImage = await page.evaluate(() => {
      const el = document.querySelector('.paywall-container');
      if (!el) return null;
      return window.getComputedStyle(el).maskImage;
    });
    expect(maskImage).toContain('linear-gradient');
  });

  test('the element with class .paywall-container has the -webkit-mask-image property applied with a linear-gradient', async ({ page }) => {
    const webkitMaskImage = await page.evaluate(() => {
      const el = document.querySelector('.paywall-container');
      if (!el) return null;
      return window.getComputedStyle(el).webkitMaskImage;
    });
    expect(webkitMaskImage).toContain('linear-gradient');
  });

  test('the gradient transitions from opaque to transparent to create a fade effect', async ({ page }) => {
    const maskImageValue = await page.evaluate(() => {
      const el = document.querySelector('.paywall-container');
      if (!el) return null;
      const computed = window.getComputedStyle(el);
      return computed.maskImage || computed.webkitMaskImage || '';
    });
    
    const colorMatches = maskImageValue?.match(/rgba?\([^)]+\)/g) || [];
    const opacities = colorMatches.map(c => {
      if (c.startsWith('rgba')) {
        const parts = c.replace(/rgba?\(|\)/g, '').split(',');
        const alpha = parseFloat(parts[3]?.trim());
        return isNaN(alpha) ? 1.0 : alpha;
      }
      return 1.0;
    });

    const hasOpaque = opacities.some(o => o >= 0.8) || maskImageValue?.includes('black') || maskImageValue?.includes('#000');
    const hasTransparent = opacities.some(o => o <= 0.2) || maskImageValue?.includes('transparent');

    expect(hasOpaque && hasTransparent).toBe(true);
  });

  test('the content remains readable even if the mask is not applied', async ({ page }) => {
    const isReadabilityObscured = await page.evaluate(() => {
      const el = document.querySelector('.paywall-container') as HTMLElement | null;
      if (!el) return true; // if element doesn't exist, it's not readable

      el.style.setProperty('mask-image', 'none', 'important');
      el.style.setProperty('-webkit-mask-image', 'none', 'important');

      const content = el.querySelector('.content') || el;
      const contentStyle = window.getComputedStyle(content);
      if (contentStyle.display === 'none' || contentStyle.visibility === 'hidden' || parseFloat(contentStyle.opacity || '1') === 0) {
        return true; // obscured/not readable
      }

      const afterComputed = window.getComputedStyle(el, '::after');
      const beforeComputed = window.getComputedStyle(el, '::before');

      const isObscuring = (style: CSSStyleDeclaration) => {
        if (!style.content || style.content === 'none') return false;
        const isAbsolute = style.position === 'absolute' || style.position === 'fixed';
        const isOpaque = parseFloat(style.opacity || '1') > 0.9;

        const hasSolidBg = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && !style.backgroundImage.includes('gradient');
        const isFullHeight = (style.top === '0px' && style.bottom === '0px') || style.height === '100%';
        const isFullWidth = (style.left === '0px' && style.right === '0px') || style.width === '100%';

        return isAbsolute && isOpaque && hasSolidBg && isFullHeight && isFullWidth;
      };

      return isObscuring(afterComputed) || isObscuring(beforeComputed);
    });

    expect(isReadabilityObscured).toBe(false);
  });
});
