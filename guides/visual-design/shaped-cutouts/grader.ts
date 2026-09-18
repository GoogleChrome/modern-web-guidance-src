import { test, expect } from '@playwright/test';
import * as path from 'path';

// Get target file from environment variable or default to demo.html
const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
const targetUrl = `file://${targetFile}`;

test('The image element with class .shaped-avatar has mask-image and -webkit-mask-image properties applied referencing a valid SVG mask ID', async ({ page }) => {
  await page.goto(targetUrl);
  
  const maskReferenceIsValid = await page.evaluate(() => {
    const avatar = document.querySelector('.shaped-avatar');
    if (!avatar) return false;
    
    const computed = window.getComputedStyle(avatar);
    const maskImage = computed.maskImage;
    const webkitMaskImage = computed.webkitMaskImage || (computed as any).WebkitMaskImage;
    
    if (!maskImage || maskImage === 'none') return false;
    if (!webkitMaskImage || webkitMaskImage === 'none') return false;
    
    const extractId = (val: string) => {
      const match = val.match(/url\(['"]?#([^'")]*)['"]?\)/);
      return match ? match[1] : null;
    };
    
    const maskId = extractId(maskImage);
    const webkitMaskId = extractId(webkitMaskImage);
    
    if (!maskId || !webkitMaskId || maskId !== webkitMaskId) return false;
    
    const maskEl = document.getElementById(maskId);
    return maskEl !== null && maskEl.tagName.toLowerCase() === 'mask';
  });

  expect(maskReferenceIsValid).toBe(true);
});

test('The decorative empty element with class .card-accent has mask-image and -webkit-mask-image properties applied referencing a valid SVG mask ID', async ({ page }) => {
  await page.goto(targetUrl);

  const accentReferenceIsValid = await page.evaluate(() => {
    const accent = document.querySelector('.card-accent');
    if (!accent) return false;
    
    // Check that it is empty or purely decorative (no non-whitespace text content)
    const text = (accent.textContent || '').trim();
    if (text.length > 0) return false;
    
    const computed = window.getComputedStyle(accent);
    const maskImage = computed.maskImage;
    const webkitMaskImage = computed.webkitMaskImage || (computed as any).WebkitMaskImage;
    
    if (!maskImage || maskImage === 'none') return false;
    if (!webkitMaskImage || webkitMaskImage === 'none') return false;
    
    const extractId = (val: string) => {
      const match = val.match(/url\(['"]?#([^'")]*)['"]?\)/);
      return match ? match[1] : null;
    };
    
    const maskId = extractId(maskImage);
    const webkitMaskId = extractId(webkitMaskImage);
    
    if (!maskId || !webkitMaskId || maskId !== webkitMaskId) return false;
    
    const maskEl = document.getElementById(maskId);
    return maskEl !== null && maskEl.tagName.toLowerCase() === 'mask';
  });

  expect(accentReferenceIsValid).toBe(true);
});

test('The SVG masks use maskContentUnits="objectBoundingBox" to scale correctly with element dimensions', async ({ page }) => {
  await page.goto(targetUrl);

  const masksAreObjectBoundingBox = await page.evaluate(() => {
    const masks = Array.from(document.querySelectorAll('mask'));
    if (masks.length === 0) return false;
    
    return masks.every(mask => mask.getAttribute('maskContentUnits') === 'objectBoundingBox');
  });

  expect(masksAreObjectBoundingBox).toBe(true);
});

test('The parent container .unified-card uses filter: drop-shadow() to silhouette the unified card and adjacent masked element', async ({ page }) => {
  await page.goto(targetUrl);

  const usesDropShadowFilter = await page.evaluate(() => {
    const card = document.querySelector('.unified-card');
    if (!card) return false;
    
    const computed = window.getComputedStyle(card);
    const filter = computed.filter;
    
    return filter.includes('drop-shadow');
  });

  expect(usesDropShadowFilter).toBe(true);
});

test('Safe layout practices are followed where all readable text content remains entirely within the standard unmasked container .card-body to prevent clipping', async ({ page }) => {
  await page.goto(targetUrl);

  const safeLayoutFollowed = await page.evaluate(() => {
    const cardBody = document.querySelector('.card-body');
    if (!cardBody) return false;

    // Check that card-body itself is unmasked
    const bodyStyles = window.getComputedStyle(cardBody);
    if (bodyStyles.maskImage !== 'none' || (bodyStyles as any).webkitMaskImage !== 'none') {
      return false;
    }

    // Check that card-body actually contains some text
    if (!cardBody.textContent || cardBody.textContent.trim().length === 0) {
      return false;
    }

    // Find the closest card container (like .unified-card or similar parent)
    const cardContainer = cardBody.closest('.unified-card') || cardBody.parentElement;
    if (!cardContainer) return false;

    // Check if there is any text content inside the card container that is OUTSIDE the card-body
    const descendants = Array.from(cardContainer.querySelectorAll('*'));
    for (const el of descendants) {
      if (!cardBody.contains(el)) {
        // This element is outside cardBody. If it contains non-whitespace text, verify if it has a mask.
        const text = (el.textContent || '').trim();
        if (text.length > 0) {
          const style = window.getComputedStyle(el);
          const hasMask = (style.maskImage && style.maskImage !== 'none') || 
                          ((style as any).webkitMaskImage && (style as any).webkitMaskImage !== 'none');
          if (hasMask) {
            return false; // Text found inside a masked element
          }
        }
      }
    }

    return true;
  });

  expect(safeLayoutFollowed).toBe(true);
});

test('The element with class .gradient-masked-card has a pure CSS radial or linear gradient applied to the mask-image and -webkit-mask-image properties', async ({ page }) => {
  await page.goto(targetUrl);

  const hasGradientMask = await page.evaluate(() => {
    const card = document.querySelector('.gradient-masked-card');
    if (!card) return false;

    const computed = window.getComputedStyle(card);
    const maskImage = computed.maskImage;
    const webkitMaskImage = computed.webkitMaskImage || (computed as any).WebkitMaskImage;

    if (!maskImage || maskImage === 'none') return false;
    if (!webkitMaskImage || webkitMaskImage === 'none') return false;

    const isGradient = (val: string) => {
      return val.includes('gradient');
    };

    return isGradient(maskImage) && isGradient(webkitMaskImage);
  });

  expect(hasGradientMask).toBe(true);
});
