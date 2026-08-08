import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve(import.meta.dirname, 'demo.html');
const targetUrl = `file://${targetFile}`;

test('The element with class .shaped-element has the mask-image property applied', async ({ page }) => {
  await page.goto(targetUrl);
  
  const hasMaskImage = await page.evaluate(() => {
    const el = document.querySelector('.shaped-element') as HTMLElement;
    if (!el) return false;
    
    // 1. Check computed style
    const computed = window.getComputedStyle(el);
    if (computed.maskImage && computed.maskImage !== 'none') {
      return true;
    }
    
    // 2. Check inline style
    if (el.style.maskImage) {
      return true;
    }
    
    // 3. Check stylesheets
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules);
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('.shaped-element')) {
            if (rule.style.maskImage || rule.style.getPropertyValue('mask-image')) {
              return true;
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'SecurityError') throw e;
      }
    }
    return false;
  });

  expect(hasMaskImage).toBe(true);
});

test('The element with class .shaped-element has the -webkit-mask-image property applied for older browser support', async ({ page }) => {
  await page.goto(targetUrl);
  
  const hasWebkitMaskImage = await page.evaluate(() => {
    const el = document.querySelector('.shaped-element') as HTMLElement;
    if (!el) return false;
    
    // 1. Check computed style
    const computed = window.getComputedStyle(el);
    if (computed.webkitMaskImage && computed.webkitMaskImage !== 'none') {
      return true;
    }
    
    // 2. Check inline style
    if (el.style.webkitMaskImage || (el.style as any).WebkitMaskImage) {
      return true;
    }
    
    // 3. Check stylesheets
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules);
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('.shaped-element')) {
            if (rule.style.webkitMaskImage || rule.style.getPropertyValue('-webkit-mask-image')) {
              return true;
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'SecurityError') throw e;
      }
    }
    return false;
  });

  expect(hasWebkitMaskImage).toBe(true);
});

test('The mask references a valid image URL or an ID of a mask element in an svg', async ({ page }) => {
  await page.goto(targetUrl);
  
  const isValidMaskReference = await page.evaluate(() => {
    const el = document.querySelector('.shaped-element') as HTMLElement;
    if (!el) return false;
    
    const computed = window.getComputedStyle(el);
    const maskImg = computed.maskImage || computed.webkitMaskImage;
    if (!maskImg || maskImg === 'none') {
      return false;
    }
    
    const match = maskImg.match(/url\s*\(\s*["']?(.*?)["']?\s*\)/i);
    if (!match) {
      return false;
    }
    
    const urlValue = match[1];
    if (!urlValue) {
      return false;
    }
    
    // Case A: SVG mask reference with a hash ID (e.g. #star-mask or file:///path/demo.html#star-mask)
    if (urlValue.includes('#')) {
      const maskId = urlValue.split('#')[1];
      const maskElement = document.getElementById(maskId);
      if (maskElement && (maskElement.tagName.toLowerCase() === 'mask' || maskElement.closest('svg'))) {
        return true;
      }
      return false;
    }
    
    // Case B: External image/SVG url
    if (urlValue.length > 0) {
      return true;
    }
    
    return false;
  });

  expect(isValidMaskReference).toBe(true);
});

test('A fallback strategy is included, such as a simpler shape with clip-path or graceful degradation to a rectangular shape', async ({ page }) => {
  await page.goto(targetUrl);
  
  const hasFallbackStrategy = await page.evaluate(() => {
    const el = document.querySelector('.shaped-element') as HTMLElement;
    if (!el) return false;
    
    // 1. Check if there are any CSS rules with @supports that check for mask-image or -webkit-mask-image
    let hasSupportsWithMask = false;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules);
        for (const rule of rules) {
          if (rule instanceof CSSSupportsRule) {
            if (rule.conditionText.includes('mask-image') || rule.conditionText.includes('-webkit-mask-image')) {
              hasSupportsWithMask = true;
              break;
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'SecurityError') throw e;
      }
    }
    
    // 2. Check if clip-path is declared in styleSheets
    let hasClipPath = false;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules);
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('.shaped-element')) {
            if (rule.style.clipPath || rule.style.getPropertyValue('clip-path')) {
              hasClipPath = true;
              break;
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'SecurityError') throw e;
      }
    }
    
    // 3. Check for overlapping blocker elements (siblings or outside elements)
    const rect = el.getBoundingClientRect();
    const allElements = Array.from(document.querySelectorAll('*'));
    let hasOverlappingBlockers = false;
    for (const other of allElements) {
      if (other === el || el.contains(other) || other.contains(el)) continue;
      if (other.tagName.toLowerCase() === 'svg' || other.closest('svg')) continue;
      
      const otherRect = other.getBoundingClientRect();
      const intersects = !(
        otherRect.right <= rect.left ||
        otherRect.left >= rect.right ||
        otherRect.bottom <= rect.top ||
        otherRect.top >= rect.bottom
      );
      if (intersects) {
        const computed = window.getComputedStyle(other);
        if (computed.position === 'absolute' || computed.position === 'fixed') {
          hasOverlappingBlockers = true;
          break;
        }
      }
    }
    
    if (hasSupportsWithMask || hasClipPath) {
      return true;
    }
    
    if (!hasOverlappingBlockers) {
      // Graceful degradation to rectangular shape (no absolute blocker siblings)
      return true;
    }
    
    return false;
  });

  expect(hasFallbackStrategy).toBe(true);
});

test('The layout does not break if the mask fails to load or is unsupported', async ({ page }) => {
  await page.goto(targetUrl);
  
  const layoutIsSolid = await page.evaluate(() => {
    const el = document.querySelector('.shaped-element') as HTMLElement;
    if (!el) return false;
    
    const computed = window.getComputedStyle(el);
    if (computed.display === 'none' || computed.visibility === 'hidden' || parseFloat(computed.opacity) === 0) {
      return false;
    }
    
    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) {
      return false;
    }
    
    // Check if there are overlapping absolute blocker elements
    const allElements = Array.from(document.querySelectorAll('*'));
    for (const other of allElements) {
      if (other === el || el.contains(other) || other.contains(el)) continue;
      if (other.tagName.toLowerCase() === 'svg' || other.closest('svg')) continue;
      
      const otherRect = other.getBoundingClientRect();
      const intersects = !(
        otherRect.right <= rect.left ||
        otherRect.left >= rect.right ||
        otherRect.bottom <= rect.top ||
        otherRect.top >= rect.bottom
      );
      if (intersects) {
        const otherComputed = window.getComputedStyle(other);
        if (otherComputed.position === 'absolute' || otherComputed.position === 'fixed') {
          // Found a blocker overlay which disrupts layout/content of the shaped-element when mask is absent
          return false;
        }
      }
    }
    
    return true;
  });

  expect(layoutIsSolid).toBe(true);
});
