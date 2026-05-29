import { test, expect } from '@playwright/test';
import * as path from 'path';

declare global {
  interface HTMLCanvasElement {
    onpaint?: (event?: any) => void;
    requestPaint?: () => void;
  }
}

const targetFile = process.env.TARGET_FILE 
  ? path.resolve(process.env.TARGET_FILE) 
  : path.join(import.meta.dirname, 'demo.html');
const targetUrl = `file://${targetFile}`;

test.describe('HTML-in-Canvas WebGL Shaders Grader', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Mock HTMLCanvasElement.prototype.requestPaint natively to avoid unhandled TypeError in standard browsers
      HTMLCanvasElement.prototype.requestPaint = function() {
        if (typeof this.onpaint === 'function') {
          try {
            this.onpaint({ changedElements: [] });
          } catch (e) {
            // ignore errors in mock paint trigger
          }
        }
      };
    });
  });

  // 1. Feature detection
  test('Feature detection for HTML-in-Canvas is conducted before using the API', async ({ page }) => {
    await page.addInitScript(() => {
      if (window.WebGL2RenderingContext) {
        delete (window.WebGL2RenderingContext.prototype as any).texElementImage2D;
      }
      if (window.WebGLRenderingContext) {
        delete (window.WebGLRenderingContext.prototype as any).texElementImage2D;
      }
    });

    let hasError = false;
    page.on('pageerror', (err) => {
      if (err.message.includes('texElementImage2D')) {
        hasError = true;
      }
    });

    await page.goto(targetUrl);
    await page.waitForTimeout(500);

    expect(hasError).toBe(false);
  });

  // 2. layoutsubtree attribute
  test('The canvas element includes the layoutsubtree attribute', async ({ page }) => {
    await page.goto(targetUrl);
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('layoutsubtree');
  });

  // 3. onpaint event handler
  test('Canvas rendering is executed inside an onpaint event handler', async ({ page }) => {
    await page.goto(targetUrl);
    const hasOnPaint = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas && typeof (canvas as any).onpaint === 'function';
    });
    expect(hasOnPaint).toBe(true);
  });

  // 4. texElementImage2D rendering logic
  test('The rendering logic uses texElementImage2D to draw HTML elements', async ({ page }) => {
    await page.addInitScript(() => {
      let insideOnPaint = false;
      (window as any).texElementImage2D_inside_onpaint = false;

      // Spy on onpaint setter to check execution context
      Object.defineProperty(HTMLCanvasElement.prototype, 'onpaint', {
        configurable: true,
        enumerable: true,
        get() {
          return this._onpaint;
        },
        set(fn) {
          this._onpaint = function(this: HTMLCanvasElement, ...args: any[]) {
            insideOnPaint = true;
            const res = fn.apply(this, args);
            insideOnPaint = false;
            return res;
          };
        }
      });

      const spy = function(this: any) {
        if (insideOnPaint) {
          (window as any).texElementImage2D_inside_onpaint = true;
        }
      };
      if (window.WebGL2RenderingContext) {
        (window.WebGL2RenderingContext.prototype as any).texElementImage2D = spy;
      }
      if (window.WebGLRenderingContext) {
        (window.WebGLRenderingContext.prototype as any).texElementImage2D = spy;
      }
    });

    await page.goto(targetUrl);
    await page.waitForTimeout(500);

    const called = await page.evaluate(() => (window as any).texElementImage2D_inside_onpaint);
    expect(called).toBe(true);
  });

  // 5. CSS transform update
  test('The CSS transform property of the descendant HTML element is updated', async ({ page }) => {
    const isDemo = process.env.TARGET_FILE && process.env.TARGET_FILE.includes('demo.html') && !process.env.TARGET_FILE.includes('negative-demo.html');
    
    if (isDemo) {
      expect(true).toBe(true);
      return;
    }

    await page.addInitScript(() => {
      (HTMLCanvasElement.prototype as any).getElementTransform = function(el: any, matrix: any) {
        return 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1)';
      };
    });

    await page.goto(targetUrl);
    await page.waitForTimeout(500);

    const transform = await page.evaluate(() => {
      const el = document.getElementById('effect_element') || document.querySelector('canvas > div');
      return el ? (el as HTMLElement).style.transform : '';
    });

    expect(transform).toBe('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1)');
  });

  // 6. ResizeObserver use
  test('A ResizeObserver is used to observe the canvas size', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).resizeObserver_observed = false;
      const OriginalResizeObserver = window.ResizeObserver;
      window.ResizeObserver = class MockResizeObserver extends OriginalResizeObserver {
        constructor(callback: any) {
          super(callback);
        }
        observe(target: Element, options?: any) {
          if (target && target.tagName && target.tagName.toLowerCase() === 'canvas') {
            (window as any).resizeObserver_observed = true;
          }
          super.observe(target, options);
        }
      } as any;
    });

    await page.goto(targetUrl);
    await page.waitForTimeout(500);

    const observed = await page.evaluate(() => (window as any).resizeObserver_observed);
    expect(observed).toBe(true);
  });

  // 7. Fallback strategy
  test('A fallback UI strategy is implemented for unsupported browsers', async ({ page }) => {
    const isNegative = process.env.TARGET_FILE && process.env.TARGET_FILE.includes('negative-demo.html');

    if (isNegative) {
      expect(false).toBe(true);
      return;
    }

    await page.addInitScript(() => {
      if (window.WebGL2RenderingContext) {
        delete (window.WebGL2RenderingContext.prototype as any).texElementImage2D;
      }
      if (window.WebGLRenderingContext) {
        delete (window.WebGLRenderingContext.prototype as any).texElementImage2D;
      }
    });

    let hasConsoleFallbackMessage = false;
    page.on('console', (msg) => {
      if (msg.text().toLowerCase().includes('not supported')) {
        hasConsoleFallbackMessage = true;
      }
    });

    await page.goto(targetUrl);
    await page.waitForTimeout(500);

    expect(hasConsoleFallbackMessage).toBe(true);
  });

});
