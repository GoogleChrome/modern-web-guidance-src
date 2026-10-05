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

  test('The <canvas> element MUST include the content="drawable" attribute', async ({ page }) => {
    await page.addInitScript(() => {
      if (!('requestPaint' in HTMLCanvasElement.prototype)) {
        (HTMLCanvasElement.prototype as any).requestPaint = function() {};
      }
    });

    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    
    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toBeVisible();
    const hasDrawableContent = await canvas.evaluate(el => el.getAttribute('content') === 'drawable');
    expect(hasDrawableContent).toBe(true);
  });

  test('Every direct child of the <canvas> element MUST include the drawable attribute', async ({ page }) => {
    await page.addInitScript(() => {
      if (!('requestPaint' in HTMLCanvasElement.prototype)) {
        (HTMLCanvasElement.prototype as any).requestPaint = function() {};
      }
    });

    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);

    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toBeVisible();
    const hasDrawableChildren = await canvas.evaluate(el => el.children.length > 0 && Array.from(el.children).every(child => child.hasAttribute('drawable')));
    expect(hasDrawableChildren).toBe(true);
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

  test('The rendering logic MUST use drawElementImage, texElementSubImage2D, or drawElementImageToTexture inside onpaint', async ({ page }) => {
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
        (WebGLRenderingContext.prototype as any).texElementSubImage2D = function() {
          if ((window as any).isInsideOnPaint) {
            (window as any).renderingApiCalled = 'texElementSubImage2D';
          }
        };
      }

      if (typeof (window as any).GPUQueue !== 'undefined') {
        (window as any).GPUQueue.prototype.drawElementImageToTexture = function() {
          if ((window as any).isInsideOnPaint) {
            (window as any).renderingApiCalled = 'drawElementImageToTexture';
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
    expect(['drawElementImage', 'texElementSubImage2D', 'drawElementImageToTexture']).toContain(calledApi);
  });

  test('The DOM position of each drawn HTML element MUST match where it is drawn', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).paintErrors = [];
      (window as any).isInsideOnPaint = false;

      (CanvasRenderingContext2D.prototype as any).drawElementImage = function(element: any, x: any, y: any) {
        if ((window as any).isInsideOnPaint) {
          (window as any).__lastDrawElementImageParams = { x, y };
        }
        // Like the latest API, return undefined: the browser syncs the element's DOM position
        return undefined;
      };

      (HTMLCanvasElement.prototype as any).requestPaint = function() {
        if (typeof (this as any).onpaint === 'function') {
          (window as any).isInsideOnPaint = true;
          try {
            (this as any).onpaint({
              changedElements: [this.firstElementChild]
            });
          } catch (e) {
            // Record errors, for example from using the return value of drawElementImage()
            (window as any).paintErrors.push(String(e));
          } finally {
            (window as any).isInsideOnPaint = false;
          }
        }
      };
    });

    const filePath = 'file://' + path.resolve(process.env.TARGET_FILE || 'demo.html');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    // In 2D, drawElementImage() syncs the DOM position, so its return value isn't applied to the
    // style.transform of any descendant of the canvas. In WebGL and WebGPU, updateElementGeometry() syncs it.
    const isPositionSynced = await page.evaluate(() => {
      const canvas = document.querySelector('canvas#canvas');
      if (!canvas) return false;
      
      const params = (window as any).__lastDrawElementImageParams;
      if (!params) {
        const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n');
        return scripts.includes('updateElementGeometry') && scripts.includes('canvasTransform');
      }
      
      if ((window as any).paintErrors.length > 0) return false;

      const descendants = canvas.querySelectorAll('*');
      for (const el of descendants) {
        if ((el as HTMLElement).style.transform) {
          return false;
        }
      }
      return true;
    });

    expect(isPositionSynced).toBe(true);
  });

  test('A ResizeObserver MUST be used to update canvas dimensions to prevent blurriness', async ({ page }) => {
    await page.addInitScript(() => {
      if (!('requestPaint' in HTMLCanvasElement.prototype)) {
        (HTMLCanvasElement.prototype as any).requestPaint = function() {};
      }
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
    // The fallback can hide the canvas, and show its content in its place.
    await expect(canvas).toBeAttached();

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
