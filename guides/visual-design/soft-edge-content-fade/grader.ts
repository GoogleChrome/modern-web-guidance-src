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

  test('The preview container or its content element has the mask-image property applied with a linear-gradient', async ({ page }) => {
    const maskImage = await page.evaluate(() => {
      const container = document.querySelector('.paywall-container') || document.querySelector('[class*="paywall"]');
      if (!container) return null;
      const candidates = [container, ...Array.from(container.querySelectorAll('*'))];
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.maskImage && style.maskImage.includes('linear-gradient')) {
          return style.maskImage;
        }
      }
      return window.getComputedStyle(container).maskImage;
    });
    expect(maskImage).toContain('linear-gradient');
  });

  test('The preview container or its content element has the -webkit-mask-image property applied with a linear-gradient', async ({ page }) => {
    const webkitMaskImage = await page.evaluate(() => {
      const container = document.querySelector('.paywall-container') || document.querySelector('[class*="paywall"]');
      if (!container) return null;
      const candidates = [container, ...Array.from(container.querySelectorAll('*'))];
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.webkitMaskImage && style.webkitMaskImage.includes('linear-gradient')) {
          return style.webkitMaskImage;
        }
      }
      return window.getComputedStyle(container).webkitMaskImage;
    });
    expect(webkitMaskImage).toContain('linear-gradient');
  });

  test('The gradient transitions from opaque to transparent to create a fade effect', async ({ page }) => {
    const maskImageValue = await page.evaluate(() => {
      const container = document.querySelector('.paywall-container') || document.querySelector('[class*="paywall"]');
      if (!container) return null;
      const candidates = [container, ...Array.from(container.querySelectorAll('*'))];
      for (const el of candidates) {
        const computed = window.getComputedStyle(el);
        const val = computed.maskImage || computed.webkitMaskImage || '';
        if (val.includes('linear-gradient')) {
          return val;
        }
      }
      const fallback = window.getComputedStyle(container);
      return fallback.maskImage || fallback.webkitMaskImage || '';
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

  test('A fallback strategy is included for browsers that do not support masking', async ({ page }) => {
    const hasFallback = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          for (const rule of Array.from(rules)) {
            if (rule.type === 12) { // CSSRule.SUPPORTS_RULE
              const cond = rule.cssText.toLowerCase();
              if (cond.includes('mask-image') || cond.includes('-webkit-mask-image')) {
                return true;
              }
            }
          }
        } catch (e: any) {
          if (e && (e.name === 'SecurityError' || e.message?.includes('SecurityError') || e.message?.includes('read the cssRules property'))) {
            // Safe to ignore cross-origin stylesheet security errors
          } else {
            throw e;
          }
        }
      }

      // Actively simulate a browser without mask-image support by disabling mask-image on the masked element
      // and verifying progressive enhancement / graceful degradation to a valid unmasked fallback state
      const container = document.querySelector('.paywall-container') || document.querySelector('[class*="paywall"]');
      if (!container) return false;
      const candidates = [container, ...Array.from(container.querySelectorAll('*'))] as HTMLElement[];
      let targetEl: HTMLElement | null = null;
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if ((style.maskImage && style.maskImage !== 'none') || (style.webkitMaskImage && style.webkitMaskImage !== 'none')) {
          targetEl = el;
          break;
        }
      }
      if (!targetEl) return false;

      targetEl.style.setProperty('mask-image', 'none', 'important');
      targetEl.style.setProperty('-webkit-mask-image', 'none', 'important');

      const unmaskedComputed = window.getComputedStyle(targetEl);
      const rect = targetEl.getBoundingClientRect();
      const hasValidUnmaskedLayout =
        unmaskedComputed.maskImage === 'none' &&
        unmaskedComputed.display !== 'none' &&
        unmaskedComputed.visibility !== 'hidden' &&
        rect.width > 50 &&
        rect.height > 20 &&
        (targetEl.textContent?.trim().length ?? 0) > 0;
      if (!hasValidUnmaskedLayout) return false;

      const afterComputed = window.getComputedStyle(targetEl, '::after');
      const beforeComputed = window.getComputedStyle(targetEl, '::before');
      const isObscuring = (style: CSSStyleDeclaration) => {
        if (!style.content || style.content === 'none') return false;
        const isAbsolute = style.position === 'absolute' || style.position === 'fixed';
        const isOpaque = parseFloat(style.opacity || '1') > 0.9;
        const hasSolidBg =
          Boolean(style.backgroundColor) &&
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
          !style.backgroundImage.includes('gradient');
        const isFullHeight = (style.top === '0px' && style.bottom === '0px') || style.height === '100%';
        const isFullWidth = (style.left === '0px' && style.right === '0px') || style.width === '100%';
        return isAbsolute && isOpaque && hasSolidBg && isFullHeight && isFullWidth;
      };
      return !isObscuring(afterComputed) && !isObscuring(beforeComputed);
    });

    expect(hasFallback).toBe(true);
  });

  test('The preview text is not obscured by an opaque overlay when masking is not applied', async ({ page }) => {
    const isReadabilityObscured = await page.evaluate(() => {
      const container = document.querySelector('.paywall-container') || document.querySelector('[class*="paywall"]');
      if (!container) return true; // if element doesn't exist, it's not readable
      
      const content = container.querySelector('[class*="content"]') || container;
      const contentStyle = window.getComputedStyle(content);
      if (contentStyle.display === 'none' || contentStyle.visibility === 'hidden' || parseFloat(contentStyle.opacity || '1') === 0) {
        return true; // obscured/not readable
      }
      
      const afterComputed = window.getComputedStyle(container, '::after');
      const beforeComputed = window.getComputedStyle(container, '::before');
      
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
