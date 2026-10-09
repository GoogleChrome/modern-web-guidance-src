import { test, expect } from '../../test-fixture.ts';
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

// Tests
test.describe(`Visually Texture Content Expectations: ${demoName}`, () => {

  // Setup browser testing
  test.beforeEach(async ({ page, TARGET_URL }) => {
    // Only mock local routes if it's a file-based demo, else let the dev server handle it
    if (TARGET_URL.startsWith('http://localhost/')) {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }

    await page.goto(TARGET_URL);
  });

  // Browser assertions
  test('The element with class .weathered-bg has the mask-image property applied', async ({ page }) => {
    const hasMaskImage = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.weathered-bg'));
      if (elements.length === 0) return false;
      return elements.every(el => {
        const candidates = [
          window.getComputedStyle(el),
          window.getComputedStyle(el, '::before'),
          window.getComputedStyle(el, '::after'),
          ...Array.from(el.children).map(c => window.getComputedStyle(c)),
        ];
        return candidates.some(style => {
          const maskImg = style.maskImage || style.getPropertyValue('mask-image');
          return Boolean(maskImg && maskImg !== 'none' && maskImg !== '');
        });
      });
    });
    expect(hasMaskImage).toBe(true);
  });

  test('The element with class .weathered-bg has the -webkit-mask-image property applied for older browser support', async ({ page }) => {
    const hasWebkitMaskImage = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.weathered-bg'));
      if (elements.length === 0) return false;
      return elements.every(el => {
        const candidates = [
          window.getComputedStyle(el),
          window.getComputedStyle(el, '::before'),
          window.getComputedStyle(el, '::after'),
          ...Array.from(el.children).map(c => window.getComputedStyle(c)),
        ];
        return candidates.some(style => {
          const webkitMaskImg = style.webkitMaskImage || style.getPropertyValue('-webkit-mask-image');
          return Boolean(webkitMaskImg && webkitMaskImg !== 'none' && webkitMaskImg !== '');
        });
      });
    });
    expect(hasWebkitMaskImage).toBe(true);
  });

  test('The mask references a repeating image pattern or SVG', async ({ page }) => {
    const hasRepeatingPatternOrSvg = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.weathered-bg'));
      if (elements.length === 0) return false;
      return elements.some(el => {
        const candidates = [
          window.getComputedStyle(el),
          window.getComputedStyle(el, '::before'),
          window.getComputedStyle(el, '::after'),
          ...Array.from(el.children).map(c => window.getComputedStyle(c)),
        ];
        return candidates.some(style => {
          const maskImg = style.maskImage || style.getPropertyValue('mask-image') || '';
          const maskRep = style.maskRepeat || style.getPropertyValue('mask-repeat') || '';
          const isSvgOrImg = maskImg.includes('.svg') || maskImg.includes('.png') || maskImg.includes('.jpg') || maskImg.includes('.jpeg') || maskImg.includes('gradient') || maskImg.includes('data:image/svg');
          const isRepeating = maskRep.includes('repeat') || maskRep === ''; // empty defaults to repeat
          return isSvgOrImg && isRepeating;
        });
      });
    });
    expect(hasRepeatingPatternOrSvg).toBe(true);
  });

  test('The mask applies a texture effect that affects the transparency of the content', async ({ page }) => {
    const appliesTextureEffect = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.weathered-bg'));
      if (elements.length === 0) return false;
      return elements.some(el => {
        const candidates = [
          window.getComputedStyle(el),
          window.getComputedStyle(el, '::before'),
          window.getComputedStyle(el, '::after'),
          ...Array.from(el.children).map(c => window.getComputedStyle(c)),
        ];
        return candidates.some(style => {
          const maskImg = style.maskImage || style.getPropertyValue('mask-image') || '';
          const maskSize = style.maskSize || style.getPropertyValue('mask-size') || '';
          const maskRepeat = style.maskRepeat || style.getPropertyValue('mask-repeat') || '';
          const hasValidImage = Boolean(maskImg && maskImg !== 'none' && (maskImg.includes('.svg') || maskImg.includes('gradient') || maskImg.includes('data:image/svg')));
          const hasValidSize = Boolean(maskSize && maskSize !== 'auto' && maskSize !== '');
          const hasValidRepeat = Boolean(maskRepeat && maskRepeat !== 'no-repeat' && maskRepeat !== '');
          return hasValidImage && (hasValidSize || hasValidRepeat);
        });
      });
    });
    expect(appliesTextureEffect).toBe(true);
  });

  test('A fallback strategy is included for browsers that do not support masking, such as a background image overlay', async ({ page }) => {
    const hasSupportsFallback = await page.evaluate(() => {
      const hasSupportsRule = Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            if (rule.type === 12 || rule instanceof CSSSupportsRule) {
              const supportsRule = rule as CSSSupportsRule;
              const condition = supportsRule.conditionText.toLowerCase();
              return condition.includes('mask-image') || condition.includes('-webkit-mask-image');
            }
            return false;
          });
        } catch (e) {
          return false;
        }
      });
      if (hasSupportsRule) return true;

      // Progressive enhancement fallback per guide.md: either @supports is used, or the mask is applied
      // on a dedicated background layer (::before, ::after, child overlay, or inside a container with a base fill)
      // so text remains unmasked and a background image/fill renders if masking is unsupported.
      const elements = Array.from(document.querySelectorAll('.weathered-bg'));
      if (elements.length === 0) return false;
      return elements.some(el => {
        const elStyle = window.getComputedStyle(el);
        const overlayStyles = [
          window.getComputedStyle(el, '::before'),
          window.getComputedStyle(el, '::after'),
          ...Array.from(el.children).map(c => window.getComputedStyle(c)),
        ];
        const hasOverlayMask = overlayStyles.some(s => {
          const m = s.maskImage || s.getPropertyValue('mask-image');
          const bgImg = s.backgroundImage || s.getPropertyValue('background-image');
          const bgCol = s.backgroundColor || s.getPropertyValue('background-color');
          const hasBg = Boolean((bgImg && bgImg !== 'none') || (bgCol && bgCol !== 'rgba(0, 0, 0, 0)' && bgCol !== 'transparent'));
          return Boolean(m && m !== 'none' && m !== '') && hasBg;
        });
        const parentStyle = el.parentElement ? window.getComputedStyle(el.parentElement) : null;
        const hasParentBaseBg = Boolean(
          parentStyle &&
          ((parentStyle.backgroundImage && parentStyle.backgroundImage !== 'none') ||
            (parentStyle.backgroundColor && parentStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && parentStyle.backgroundColor !== 'transparent'))
        );
        const elMask = elStyle.maskImage || elStyle.getPropertyValue('mask-image');
        const hasDirectMaskWithParentFallback =
          Boolean(elMask && elMask !== 'none' && elMask !== '') &&
          hasParentBaseBg &&
          el.children.length === 0 &&
          (el.textContent || '').trim().length === 0;
        return hasOverlayMask || hasDirectMaskWithParentFallback;
      });
    });
    expect(hasSupportsFallback).toBe(true);
  });

});
