/// <reference types="node" />
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

declare const process: any;

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Anchor Positioning Tab Underline Expectations: ${demoName}`, () => {

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
    
    // Inject navigation prevention
    await page.evaluate(() => {
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'A' || target.closest('a')) {
          e.preventDefault();
        }
      }, true);
    });
  });

  const getBeforeData = async (page: any) => {
    return await page.evaluate(() => {
      const ul = document.querySelector('ul');
      const li = document.querySelector('li.active');
      if (!ul || !li) return null;

      const style = window.getComputedStyle(ul, '::before');
      const liRect = li.getBoundingClientRect();

      const content = style.content;
      const isRendered = content !== 'none' && content !== 'normal' && content !== '';

      // For pseudo-elements, we can't use getBoundingClientRect directly.
      // But we can get its computed top/left relative to its containing block.
      // Or we can use a trick: check if the browser supports getting rects for pseudos (it doesn't usually).
      // Instead, we'll calculate its absolute position based on its containing block.
      
      let cb: HTMLElement | Element = ul;
      while (cb && cb !== document.documentElement) {
        const cbStyle = window.getComputedStyle(cb);
        if (cbStyle.position !== 'static' || cbStyle.transform !== 'none' || cbStyle.perspective !== 'none' || cbStyle.containerType !== 'normal') {
          break;
        }
        if (cb.parentElement) {
          cb = cb.parentElement;
        } else {
          break;
        }
      }
      if (!cb) cb = document.documentElement;
      
      const cbRect = cb.getBoundingClientRect();
      const cbStyle = window.getComputedStyle(cb);
      const top = parseFloat(style.top) || 0;
      const left = parseFloat(style.left) || 0;
      const width = parseFloat(style.width) || 0;
      const height = parseFloat(style.height) || 0;

      return {
        isRendered,
        content: style.content,
        width,
        height,
        left: cbRect.left + (parseFloat(cbStyle.borderLeftWidth) || 0) + left,
        top: cbRect.top + (parseFloat(cbStyle.borderTopWidth) || 0) + top,
        rawLeft: style.left,
        rawTop: style.top,
        liRect: {
          left: liRect.left,
          top: liRect.top,
          width: liRect.width,
          height: liRect.height,
          bottom: liRect.bottom,
          right: liRect.right
        },
        transition: style.transition
      };
    });
  };

  test('There is an underline element visible under the active tab item.', async ({ page }) => {
    const data = await getBeforeData(page);
    expect(data).not.toBeNull();
    expect(data!.isRendered).toBe(true);
    expect(data!.height).toBeGreaterThan(0);
    expect(data!.width).toBeGreaterThan(0);
    // Check that it is actually "under" (below) the tab item
    // Relaxed to 2px above to allow for minor overlaps/rounding
    expect(data!.top).toBeGreaterThanOrEqual(data!.liRect.bottom - 2);
  });

  test('The underline element is the width of the active tab item.', async ({ page }) => {
    const data = await getBeforeData(page);
    expect(data).not.toBeNull();
    expect(data!.isRendered).toBe(true);
    // Use 1.5px tolerance for rounding
    expect(Math.abs(data!.width - data!.liRect.width)).toBeLessThan(1.5);
  });

  test("The underline element's inline start edge is aligned to the active tab item's inline start edge.", async ({ page }) => {
    const data = await getBeforeData(page);
    expect(data).not.toBeNull();
    expect(data!.isRendered).toBe(true);
    expect(data!.rawLeft).not.toBe('auto');
    expect(Math.abs(data!.left - data!.liRect.left)).toBeLessThan(1.5);
  });

  test("The underline element's inline end edge is aligned to the active tab item's inline end edge.", async ({ page }) => {
    const data = await getBeforeData(page);
    expect(data).not.toBeNull();
    expect(data!.isRendered).toBe(true);
    const pseudoRight = data!.left + data!.width;
    expect(Math.abs(pseudoRight - data!.liRect.right)).toBeLessThan(1.5);
  });

  test("The underline element's block start edge is positioned below the block end edge of the active tab item.", async ({ page }) => {
    const data = await getBeforeData(page);
    expect(data).not.toBeNull();
    expect(data!.isRendered).toBe(true);
    // Allow it to be slightly above for rounding, but generally below
    expect(data!.top).toBeGreaterThanOrEqual(data!.liRect.bottom - 2);
  });

  test('Changing the active page moves the underline element to be positioned underneath the new active tab item.', async ({ page }) => {
    const tabs = page.locator('ul li');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(1);

    // Click the second tab
    await tabs.nth(1).click();
    await page.waitForTimeout(300); // Wait for transition

    const data = await getBeforeData(page);
    expect(data).not.toBeNull();
    expect(data!.isRendered).toBe(true);
    expect(Math.abs(data!.width - data!.liRect.width)).toBeLessThan(1.5);
    expect(Math.abs(data!.left - data!.liRect.left)).toBeLessThan(1.5);
  });

  test('When prefers-reduced-motion: reduce is enabled, there is no animation.', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();

    const data = await getBeforeData(page);
    expect(data).not.toBeNull();
    expect(data!.isRendered).toBe(true);
    
    // Transition should not contain 'inset'
    expect(data!.transition).not.toContain('inset');
  });

  test('When prefers-reduced-motion: no-preference is enabled, the underline animates.', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();

    const data = await getBeforeData(page);
    expect(data).not.toBeNull();
    expect(data!.isRendered).toBe(true);
    
    // Should have transition on inset
    expect(data!.transition).toContain('inset');
    expect(data!.transition).not.toContain('inset 0s');
  });

  test('The underline is created using a ::before pseudo-element on the <ul>.', async ({ page }) => {
     const data = await getBeforeData(page);
     expect(data).not.toBeNull();
     expect(data!.isRendered).toBe(true);
     // Since we already check ::before in getBeforeData, if isRendered is true, it passes.
  });

});
