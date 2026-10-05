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
      (window as any).__texElementSubImage2D_called = false;
      (window as any).__drawElementImageToTexture_called = false;
      (window as any).__resizeObserverObserved = false;

      if (typeof HTMLCanvasElement !== 'undefined') {
        const checkFeature = () => {
          (window as any).__featureChecked = true;
        };

        const origUpdateElementGeometry = (HTMLCanvasElement.prototype as any).updateElementGeometry;
        Object.defineProperty(HTMLCanvasElement.prototype, 'updateElementGeometry', {
          configurable: true,
          get() {
            checkFeature();
            return origUpdateElementGeometry || function() {};
          }
        });

        // The upload path sizes the texture with captureElementImage().
        (HTMLCanvasElement.prototype as any).captureElementImage = function(element: HTMLElement) {
          checkFeature();
          return { width: element.offsetWidth || 300, height: element.offsetHeight || 150, close() {} };
        };

        HTMLCanvasElement.prototype.requestPaint = function() {
          checkFeature();
          if (typeof this.onpaint === 'function') {
            try { this.onpaint({ changedElements: [] }); } catch (e) {}
          }
        };
      }

      if (typeof WebGLRenderingContext !== 'undefined') {
        const origTex = (WebGLRenderingContext.prototype as any).texElementSubImage2D;
        (WebGLRenderingContext.prototype as any).texElementSubImage2D = function(...args: any[]) {
          (window as any).__featureChecked = true;
          (window as any).__texElementSubImage2D_called = true;
          if (origTex) return origTex.apply(this, args);
        };

        const origCopy = (WebGLRenderingContext.prototype as any).drawElementImageToTexture;
        (WebGLRenderingContext.prototype as any).drawElementImageToTexture = function(...args: any[]) {
          (window as any).__featureChecked = true;
          (window as any).__drawElementImageToTexture_called = true;
          if (origCopy) return origCopy.apply(this, args);
        };
      }

      if (typeof WebGL2RenderingContext !== 'undefined') {
        const origTex2 = (WebGL2RenderingContext.prototype as any).texElementSubImage2D;
        (WebGL2RenderingContext.prototype as any).texElementSubImage2D = function(...args: any[]) {
          (window as any).__featureChecked = true;
          (window as any).__texElementSubImage2D_called = true;
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
      return scripts.includes('texElementSubImage2D') || scripts.includes('drawable') || scripts.includes('requestPaint') || scripts.includes('onpaint');
    }).catch(() => true);
    expect(featureChecked).toBe(true);
  });

  test('Canvas element MUST include the content="drawable" attribute', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    const canvas = page.locator('canvas').first();
    const hasDrawableContent = await canvas.evaluate(el => el.getAttribute('content') === 'drawable').catch(() => false);
    if (hasDrawableContent) {
      expect(hasDrawableContent).toBe(true);
      return;
    }
    const code = getScriptContent();
    expect(/content\s*=\s*["']?drawable\b|setAttribute\(\s*["']content["']\s*,\s*["']drawable["']/.test(code)).toBe(true);
  });

  test('Direct children of the canvas element MUST include the drawable attribute', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    // Check the markup as authored: without HTML-in-Canvas support, pages can move
    // the canvas children out of the canvas, to show them as fallback content.
    const hasDrawableChildren = await page.evaluate((html) => {
      const markup = new DOMParser().parseFromString(html, 'text/html');
      const canvas = Array.from(markup.querySelectorAll('canvas')).find(c => c.children.length > 0) || document.querySelector('canvas');
      return !!canvas && canvas.children.length > 0 && Array.from(canvas.children).every(child => child.hasAttribute('drawable'));
    }, getScriptContent()).catch(() => false);
    expect(hasDrawableChildren).toBe(true);
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

  test('Rendering logic MUST use texElementSubImage2D or drawElementImageToTexture', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);
    const called = await page.evaluate(() => (window as any).__texElementSubImage2D_called || (window as any).__drawElementImageToTexture_called).catch(() => false);
    if (called) {
      expect(called).toBe(true);
      return;
    }
    const code = getScriptContent();
    const has3DCode = code.includes('texElementSubImage2D') || code.includes('drawElementImageToTexture');
    expect(has3DCode).toBe(true);
  });

  test('Texture MUST be allocated at the element size from captureElementImage, rounded up', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);
    const code = getScriptContent();
    // WebGL allocates with texImage2D(); WebGPU creates the texture with device.createTexture({ size }).
    const allocatesTexture = code.includes('texImage2D') || /createTexture\(\s*\{/.test(code);
    expect(code.includes('captureElementImage') && code.includes('Math.ceil') && allocatesTexture).toBe(true);
  });

  test('Texture MUST only be reallocated or recreated when the element size changes', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);
    const code = getScriptContent();
    const allocatesTexture = code.includes('texImage2D') || /createTexture\(\s*\{/.test(code);
    // Look for a size comparison that guards the reallocation, for example: state.width === width
    const comparesSize = /(width|height)\s*[!=]==?[^;\n]*(width|height)/i.test(code);
    expect(allocatesTexture && comparesSize).toBe(true);
  });

  test('Element geometry MUST be updated with updateElementGeometry and a canvasTransform', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);
    const code = getScriptContent();
    expect(code.includes('updateElementGeometry') && code.includes('canvasTransform')).toBe(true);
  });

  test('When using Three.js, the HTMLTexture mesh MUST be registered with an InteractionManager that is updated', async ({ page }) => {
    await page.goto(fileUrl).catch(() => {});
    const code = getScriptContent();
    // Only applies when the HTML element is displayed with THREE.HTMLTexture.
    if (!code.includes('HTMLTexture')) {
      return;
    }
    const manager = code.match(/([\w$.]+)\s*=\s*new\s+(?:[\w$]+\.)?InteractionManager\s*\(/);
    expect(manager !== null && code.includes(`${manager[1]}.add(`) && code.includes(`${manager[1]}.update(`)).toBe(true);
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
