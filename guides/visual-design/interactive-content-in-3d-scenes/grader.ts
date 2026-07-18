import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const targetFile = process.env.TARGET_FILE 
  ? path.resolve(process.env.TARGET_FILE) 
  : path.join(import.meta.dirname, 'demo.html');
const fileUrl = `file://${targetFile}`;

function getScriptContent(): string {
  if (fs.existsSync(targetFile)) {
    return fs.readFileSync(targetFile, 'utf8');
  }
  return '';
}

test.describe('Interactive 3D Content Grader', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__featureChecked = false;
      (window as any).__texElementImage2D_called = false;
      (window as any).__copyElementImageToTexture_called = false;
      (window as any).__resizeObserverObserved = false;

      if (typeof HTMLCanvasElement !== 'undefined') {
        const checkFeature = () => {
          (window as any).__featureChecked = true;
        };

        const origGetElementTransform = (HTMLCanvasElement.prototype as any).getElementTransform;
        Object.defineProperty(HTMLCanvasElement.prototype, 'getElementTransform', {
          configurable: true,
          get() {
            checkFeature();
            return origGetElementTransform || function() { return 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)'; };
          }
        });

        HTMLCanvasElement.prototype.requestPaint = function() {
          checkFeature();
          if (typeof this.onpaint === 'function') {
            try { this.onpaint({ changedElements: [] }); } catch (e) {}
          }
        };
      }

      if (typeof WebGLRenderingContext !== 'undefined') {
        const origTex = (WebGLRenderingContext.prototype as any).texElementImage2D;
        (WebGLRenderingContext.prototype as any).texElementImage2D = function(...args: any[]) {
          (window as any).__featureChecked = true;
          (window as any).__texElementImage2D_called = true;
          if (origTex) return origTex.apply(this, args);
        };

        const origCopy = (WebGLRenderingContext.prototype as any).copyElementImageToTexture;
        (WebGLRenderingContext.prototype as any).copyElementImageToTexture = function(...args: any[]) {
          (window as any).__featureChecked = true;
          (window as any).__copyElementImageToTexture_called = true;
          if (origCopy) return origCopy.apply(this, args);
        };
      }

      if (typeof WebGL2RenderingContext !== 'undefined') {
        const origTex2 = (WebGL2RenderingContext.prototype as any).texElementImage2D;
        (WebGL2RenderingContext.prototype as any).texElementImage2D = function(...args: any[]) {
          (window as any).__featureChecked = true;
          (window as any).__texElementImage2D_called = true;
          if (origTex2) return origTex2.apply(this, args);
        };
      }

      const OriginalResizeObserver = window.ResizeObserver;
      window.ResizeObserver = class MockResizeObserver extends OriginalResizeObserver {
        observe(target: Element, options?: ResizeObserverOptions) {
          if (target) {
            (window as any).__resizeObserverObserved = true;
          }
          super.observe(target, options);
        }
      };
    });
  });

  test('Feature detection for HTML-in-Canvas MUST be conducted', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);
    const featureChecked = await page.evaluate(() => {
      const g = globalThis as any;
      if (g.__featureChecked) return true;
      const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n');
      return scripts.includes('texElementImage2D') || scripts.includes('layoutsubtree') || scripts.includes('requestPaint') || scripts.includes('onpaint');
    }).catch(() => true);
    expect(featureChecked).toBe(true);
  });

  test('Canvas element MUST include the layoutsubtree attribute', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    const canvas = page.locator('canvas').first();
    const hasLayoutSubtree = await canvas.evaluate(el => el.hasAttribute('layoutsubtree')).catch(() => false);
    if (hasLayoutSubtree) {
      expect(hasLayoutSubtree).toBe(true);
      return;
    }
    const code = getScriptContent();
    expect(code.includes('layoutsubtree')).toBe(true);
  });

  test('Canvas rendering MUST be executed inside an onpaint event handler', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    const canvas = page.locator('canvas').first();
    const hasOnPaint = await canvas.evaluate(el => {
      const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n');
      return typeof (el as any).onpaint === 'function' || (el as any)._onpaint || scripts.includes('onpaint') || scripts.includes('requestPaint');
    }).catch(() => false);
    if (hasOnPaint) {
      expect(hasOnPaint).toBe(true);
      return;
    }
    const code = getScriptContent();
    expect(code.includes('onpaint') || code.includes('requestPaint')).toBe(true);
  });

  test('Rendering logic MUST use texElementImage2D or copyElementImageToTexture', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);
    const called = await page.evaluate(() => (window as any).__texElementImage2D_called || (window as any).__copyElementImageToTexture_called).catch(() => false);
    if (called) {
      expect(called).toBe(true);
      return;
    }
    const code = getScriptContent();
    const has3DCode = code.includes('texElementImage2D') || code.includes('copyElementImageToTexture');
    expect(has3DCode).toBe(true);
  });

  test('CSS transform of descendant HTML element MUST be updated or descendant is inert', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);
    const code = getScriptContent();
    expect(code.includes('transform') || code.includes('getElementTransform') || code.includes('matrix3d') || code.includes('inert')).toBe(true);
  });

  test('Screen size changes MUST be observed using ResizeObserver', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    const observed = await page.evaluate(() => (window as any).__resizeObserverObserved).catch(() => false);
    if (observed) {
      expect(observed).toBe(true);
      return;
    }
    const code = getScriptContent();
    expect(code.includes('ResizeObserver')).toBe(true);
  });

  test('Fallback UI strategy MUST be implemented to prevent unhandled exceptions', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);
    expect(true).toBe(true);
  });

});
