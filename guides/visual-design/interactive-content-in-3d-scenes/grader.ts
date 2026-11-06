import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const targetFile = process.env.TARGET_FILE 
  ? path.resolve(process.env.TARGET_FILE) 
  : path.join(import.meta.dirname, 'demo.html');
const targetDir = path.dirname(targetFile);
const targetFileName = path.basename(targetFile);
const fileUrl = `http://localhost/${targetFileName}`;

function getScriptContent(): string {
  const parts: string[] = [];
  if (fs.existsSync(targetFile)) {
    parts.push(fs.readFileSync(targetFile, 'utf8'));
  }
  try {
    for (const f of fs.readdirSync(targetDir)) {
      if ((f.endsWith('.js') || f.endsWith('.mjs')) && !f.includes('.test.')) {
        parts.push(fs.readFileSync(path.join(targetDir, f), 'utf8'));
      }
    }
  } catch {}
  return parts.join('\n');
}

test.describe('Interactive 3D Content Grader', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = requestPath === '/' ? targetFileName : requestPath.replace(/^\/+/, '');
      const localFilePath = path.resolve(targetDir, relPath);
      if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
    await page.addInitScript(() => {
      (window as any).__texElementSubImage2D_called = false;
      (window as any).__drawElementImageToTexture_called = false;
      (window as any).__resizeObserverObserved = false;

      if (typeof HTMLCanvasElement !== 'undefined') {
        if (!('content' in HTMLCanvasElement.prototype)) {
          Object.defineProperty(HTMLCanvasElement.prototype, 'content', {
            configurable: true,
            enumerable: true,
            get() {
              return this.getAttribute('content')?.toLowerCase() === 'drawable' ? 'drawable' : 'fallback';
            },
            set(value) {
              this.setAttribute('content', String(value));
            },
          });
        }

        const origUpdateElementGeometry = (HTMLCanvasElement.prototype as any).updateElementGeometry;
        Object.defineProperty(HTMLCanvasElement.prototype, 'updateElementGeometry', {
          configurable: true,
          get() {
            return origUpdateElementGeometry || function() {};
          }
        });

        // The upload path sizes the texture with captureElementImage().
        (HTMLCanvasElement.prototype as any).captureElementImage = function(element: HTMLElement) {
          return { width: element.offsetWidth || 300, height: element.offsetHeight || 150, close() {} };
        };

        HTMLCanvasElement.prototype.requestPaint = function() {
          if (typeof this.onpaint === 'function') {
            try { this.onpaint({ changedElements: [] }); } catch (e) {}
          }
        };
      }

      if (typeof WebGLRenderingContext !== 'undefined') {
        const origTex = (WebGLRenderingContext.prototype as any).texElementSubImage2D;
        (WebGLRenderingContext.prototype as any).texElementSubImage2D = function(...args: any[]) {
          (window as any).__texElementSubImage2D_called = true;
          if (origTex) return origTex.apply(this, args);
        };
      }

      if (typeof (window as any).GPUQueue !== 'undefined') {
        const origCopy = (window as any).GPUQueue.prototype.drawElementImageToTexture;
        (window as any).GPUQueue.prototype.drawElementImageToTexture = function(...args: any[]) {
          (window as any).__drawElementImageToTexture_called = true;
          if (origCopy) return origCopy.apply(this, args);
        };
      }

      if (typeof WebGL2RenderingContext !== 'undefined') {
        const origTex2 = (WebGL2RenderingContext.prototype as any).texElementSubImage2D;
        (WebGL2RenderingContext.prototype as any).texElementSubImage2D = function(...args: any[]) {
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
    // Pages detect the latest API surface with 'content' in HTMLCanvasElement.prototype.
    // Members such as requestPaint also exist in earlier builds that lack the content attribute.
    const code = getScriptContent();
    expect(/['"]content['"]\s+in\b/.test(code)).toBe(true);
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

  test('Each drawn HTML element MUST be registered with updateElementGeometry and a canvasTransform', async ({ page }) => {
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
    await page.addInitScript(() => {
      // Simulate a browser without HTML-in-Canvas support, including removing the mocks from beforeEach.
      for (const member of ['content', 'requestPaint', 'captureElementImage', 'updateElementGeometry']) {
        delete (HTMLCanvasElement.prototype as any)[member];
      }
      if (typeof WebGLRenderingContext !== 'undefined') {
        delete (WebGLRenderingContext.prototype as any).texElementSubImage2D;
      }
      if (typeof WebGL2RenderingContext !== 'undefined') {
        delete (WebGL2RenderingContext.prototype as any).texElementSubImage2D;
      }
      if (typeof (window as any).GPUQueue !== 'undefined') {
        delete (window as any).GPUQueue.prototype.drawElementImageToTexture;
      }
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (!/Tainted canvases may not be loaded/i.test(err.message)) {
        pageErrors.push(err.message);
      }
    });

    await page.goto(fileUrl).catch(() => {});
    await page.waitForTimeout(200);

    expect(pageErrors).toEqual([]);

    const html = getScriptContent();
    const parts = [html];
    const baseDir = path.dirname(targetFile);
    const scriptSrcRegex = /<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = scriptSrcRegex.exec(html)) !== null) {
      const src = match[1];
      if (!/^https?:\/\//i.test(src) && !src.startsWith('//')) {
        const jsPath = path.resolve(baseDir, src);
        if (fs.existsSync(jsPath)) {
          parts.push(fs.readFileSync(jsPath, 'utf8'));
        }
      }
    }
    const code = parts.join('\n');
    const hasFallbackStrategy =
      /['"]content['"]\s+in\b|three-html-render|installHtmlInCanvasPolyfill/i.test(
        code
      );
    expect(hasFallbackStrategy).toBe(true);
  });

});
