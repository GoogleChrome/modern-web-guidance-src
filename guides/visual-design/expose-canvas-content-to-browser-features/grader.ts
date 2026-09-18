import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('HTML-in-Canvas Grader Tests', () => {

  test('Feature detection for HTML-in-Canvas MUST be conducted before using the HTML-in-Canvas API', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    
    // Only polyfill requestPaint as a safe handler, do NOT polyfill drawElementImage
    await page.addInitScript(() => {
      if (!('requestPaint' in HTMLCanvasElement.prototype)) {
        (HTMLCanvasElement.prototype as any).requestPaint = function() {};
      }
    });

    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    const drawElementImageErrors = pageErrors.filter(err => err.message.includes('drawElementImage'));
    expect(drawElementImageErrors.length).toBe(0);
  });

  test('The <canvas> element MUST include the layoutsubtree attribute', async ({ page }) => {
    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    
    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toBeVisible();
    const hasLayoutSubtree = await canvas.evaluate(el => el.hasAttribute('layoutsubtree'));
    expect(hasLayoutSubtree).toBe(true);
  });

  test('Canvas rendering MUST be executed inside an onpaint event handler', async ({ page }) => {
    await page.addInitScript(() => {
      if (!('requestPaint' in HTMLCanvasElement.prototype)) {
        (HTMLCanvasElement.prototype as any).requestPaint = function() {};
      }
      if (!('drawElementImage' in CanvasRenderingContext2D.prototype)) {
        (CanvasRenderingContext2D.prototype as any).drawElementImage = function() {
          return new DOMMatrix();
        };
      }
    });

    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    await page.waitForTimeout(500);
    
    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toBeVisible();
    const hasOnPaint = await canvas.evaluate(el => typeof (el as any).onpaint === 'function');
    expect(hasOnPaint).toBe(true);
  });

  test('The rendering logic MUST use drawElementImage, texElementImage2D, or copyElementImageToTexture inside onpaint', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).renderingApiCalled = null;
      (window as any).isInsideOnPaint = false;

      (CanvasRenderingContext2D.prototype as any).drawElementImage = function() {
        if ((window as any).isInsideOnPaint) {
          (window as any).renderingApiCalled = 'drawElementImage';
        }
        return new DOMMatrix();
      };

      if (typeof WebGLRenderingContext !== 'undefined') {
        (WebGLRenderingContext.prototype as any).texElementImage2D = function() {
          if ((window as any).isInsideOnPaint) {
            (window as any).renderingApiCalled = 'texElementImage2D';
          }
        };
      }

      if (typeof (window as any).GPUQueue !== 'undefined') {
        (window as any).GPUQueue.prototype.copyElementImageToTexture = function() {
          if ((window as any).isInsideOnPaint) {
            (window as any).renderingApiCalled = 'copyElementImageToTexture';
          }
        };
      }

      (HTMLCanvasElement.prototype as any).requestPaint = function() {
        if (typeof (this as any).onpaint === 'function') {
          (window as any).isInsideOnPaint = true;
          try {
            (this as any).onpaint({
              changedElements: [this.firstElementChild]
            });
          } finally {
            (window as any).isInsideOnPaint = false;
          }
        }
      };
    });

    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    const calledApi = await page.evaluate(() => (window as any).renderingApiCalled);
    expect(['drawElementImage', 'texElementImage2D', 'copyElementImageToTexture']).toContain(calledApi);
  });

  test('The CSS transform property of the descendant HTML element MUST be updated based on the transform matrix', async ({ page }) => {
    await page.addInitScript(() => {
      (CanvasRenderingContext2D.prototype as any).drawElementImage = function(element: any, x: any, y: any) {
        (window as any).__lastDrawElementImageParams = { x, y };
        // Return a unique DOMMatrix translating by x + 500, y + 500
        return new DOMMatrix([1, 0, 0, 1, x + 500, y + 500]);
      };

      (HTMLCanvasElement.prototype as any).requestPaint = function() {
        if (typeof (this as any).onpaint === 'function') {
          try {
            (this as any).onpaint({
              changedElements: [this.firstElementChild]
            });
          } catch (e) {}
        }
      };
    });

    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    // Find if any descendant of the canvas has style.transform updated to match the expected translation
    const hasUpdatedTransform = await page.evaluate(() => {
      const canvas = document.querySelector('canvas#canvas');
      if (!canvas) return false;
      
      const params = (window as any).__lastDrawElementImageParams;
      if (!params) return false;
      
      const expectedX = params.x + 500;
      const expectedY = params.y + 500;

      const descendants = canvas.querySelectorAll('*');
      for (const el of descendants) {
        const transformStyle = (el as HTMLElement).style.transform || '';
        // Parse matrix(1, 0, 0, 1, tx, ty)
        const match = transformStyle.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([^,]+),\s*([^)]+)\)/);
        if (match) {
          const tx = parseFloat(match[1]);
          const ty = parseFloat(match[2]);
          // Check if they match our expected translation, permitting floating point errors
          if (Math.abs(tx - expectedX) < 1 && Math.abs(ty - expectedY) < 1) {
            return true;
          }
        }
      }
      return false;
    });

    expect(hasUpdatedTransform).toBe(true);
  });

  test('A ResizeObserver MUST be used to update canvas dimensions to prevent blurriness', async ({ page }) => {
    await page.addInitScript(() => {
      if (typeof ResizeObserverEntry !== 'undefined') {
        try {
          delete (ResizeObserverEntry.prototype as any).devicePixelContentBoxSize;
        } catch (e) {}
      }
      Object.defineProperty(window, 'devicePixelRatio', {
        get: () => 2.5
      });
    });

    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toBeVisible();

    const isScaled = await canvas.evaluate(el => {
      const dpr = window.devicePixelRatio;
      const canvasEl = el as HTMLCanvasElement;
      const expectedWidth = Math.round(canvasEl.clientWidth * dpr);
      const expectedHeight = Math.round(canvasEl.clientHeight * dpr);
      // Allow small rounding tolerance +/- 1px
      return Math.abs(canvasEl.width - expectedWidth) <= 1 && Math.abs(canvasEl.height - expectedHeight) <= 1;
    });

    expect(isScaled).toBe(true);
  });

  test('A fallback UI strategy MUST be implemented for browsers that do not support HTML-in-Canvas', async ({ page }) => {
    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    
    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toBeVisible();

    // Grader resilience: The fallback elements must either sit statically inside the canvas element,
    // or (if the fallback is interactive and reparented dynamically for visual overlays styling) float on its outer container stage.
    const isValidFallback = await canvas.evaluate(el => {
      const hasFallbackInside = el.children.length > 0;
      const parent = el.parentElement;
      const hasFormFloating = parent ? parent.querySelector('form, input, select, button') !== null : false;
      
      const hasIframe = el.querySelector('iframe') !== null || (parent ? parent.querySelector('iframe') !== null : false);
      return (hasFallbackInside || hasFormFloating) && !hasIframe;
    });

    expect(isValidFallback).toBe(true);
  });

});
