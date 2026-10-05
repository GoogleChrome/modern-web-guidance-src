import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

declare global {
  interface HTMLCanvasElement {
    onpaint?: (event?: any) => void;
    requestPaint?: () => void;
  }
}

const targetFile = process.env.TARGET_FILE 
  ? path.resolve(process.env.TARGET_FILE) 
  : path.join(import.meta.dirname, 'demo.html');
const targetDir = path.dirname(targetFile);
const targetFileName = path.basename(targetFile);
const targetUrl = `http://localhost/${targetFileName}`;

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

test.describe('HTML-in-Canvas WebGL Shaders Grader', () => {

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
      HTMLCanvasElement.prototype.requestPaint = function() {
        if (typeof this.onpaint === 'function') {
          try {
            this.onpaint({ changedElements: [] });
          } catch (e) {
            // ignore
          }
        }
      };
    });
  });

  test('Feature detection for HTML-in-Canvas is conducted before using the API', async ({ page }) => {
    let hasError = false;
    page.on('pageerror', (err) => {
      if (/texElementSubImage2D|texElementImage2D|captureElementImage|updateElementGeometry/.test(err.message)) {
        hasError = true;
      }
    });

    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);

    expect(hasError).toBe(false);
  });

  test('The canvas element includes the content="drawable" attribute', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const canvas = page.locator('canvas').first();
    const hasDrawableContent = await canvas.evaluate(el => el.getAttribute('content') === 'drawable').catch(() => false);
    if (hasDrawableContent) {
      expect(hasDrawableContent).toBe(true);
      return;
    }
    const code = getScriptContent();
    expect(/content\s*=\s*["']?drawable\b|setAttribute\(\s*["']content["']\s*,\s*["']drawable["']/.test(code)).toBe(true);
  });

  test('The direct children of the canvas element include the drawable attribute', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    // Check the markup as authored: without HTML-in-Canvas support, pages can move
    // the canvas children out of the canvas, to show them as fallback content.
    const hasDrawableChildren = await page.evaluate((html) => {
      const markup = new DOMParser().parseFromString(html, 'text/html');
      const canvas = Array.from(markup.querySelectorAll('canvas')).find(c => c.children.length > 0) || document.querySelector('canvas');
      return !!canvas && canvas.children.length > 0 && Array.from(canvas.children).every(child => child.hasAttribute('drawable'));
    }, getScriptContent()).catch(() => false);
    expect(hasDrawableChildren).toBe(true);
  });

  test('Canvas rendering is executed inside an onpaint event handler', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const hasOnPaint = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n');
      return (canvas && (typeof (canvas as any).onpaint === 'function' || (canvas as any)._onpaint)) || scripts.includes('onpaint') || scripts.includes('requestPaint');
    }).catch(() => false);
    if (hasOnPaint) {
      expect(hasOnPaint).toBe(true);
      return;
    }
    const code = getScriptContent();
    expect(code.includes('onpaint') || code.includes('requestPaint')).toBe(true);
  });

  test('The rendering logic uses texElementSubImage2D to upload HTML elements into a WebGL texture', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);
    const code = getScriptContent();
    expect(code.includes('texElementSubImage2D') || code.includes('drawElementImageToTexture')).toBe(true);
  });

  test('The WebGL texture is allocated with texImage2D at the element size from captureElementImage, rounded up', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);
    const code = getScriptContent();
    expect(code.includes('captureElementImage') && code.includes('Math.ceil') && code.includes('texImage2D')).toBe(true);
  });

  test('The WebGL texture is only reallocated with texImage2D when the element size changes', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);
    const code = getScriptContent();
    // Look for a size comparison that guards the reallocation, for example: state.width === width
    const comparesSize = /(width|height)\s*[!=]==?[^;\n]*(width|height)/i.test(code);
    expect(code.includes('texImage2D') && comparesSize).toBe(true);
  });

  test('Each drawn HTML element is registered with updateElementGeometry and a canvasTransform', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);
    const code = getScriptContent();
    expect(code.includes('updateElementGeometry') && code.includes('canvasTransform')).toBe(true);
  });

  test('A ResizeObserver is used to observe the canvas size', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);
    const code = getScriptContent();
    expect(code.includes('ResizeObserver')).toBe(true);
  });

  test('A fallback UI strategy is implemented for unsupported browsers', async ({ page }) => {
    await page.addInitScript(() => {
      if (typeof WebGLRenderingContext !== 'undefined') {
        delete (WebGLRenderingContext.prototype as any).texElementImage2D;
        delete (WebGLRenderingContext.prototype as any).copyElementImageToTexture;
      }
      if (typeof WebGL2RenderingContext !== 'undefined') {
        delete (WebGL2RenderingContext.prototype as any).texElementImage2D;
        delete (WebGL2RenderingContext.prototype as any).copyElementImageToTexture;
      }
      if (typeof GPUQueue !== 'undefined') {
        delete (GPUQueue.prototype as any).copyElementImageToTexture;
      }
      if (typeof HTMLCanvasElement !== 'undefined') {
        delete (HTMLCanvasElement.prototype as any).getElementTransform;
        HTMLCanvasElement.prototype.requestPaint = function () {
          if (typeof (this as any).onpaint === 'function') {
            (this as any).onpaint({ changedElements: [] });
          }
        };
      }
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (!/Tainted canvases may not be loaded/i.test(err.message)) {
        pageErrors.push(err.message);
      }
    });

    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);

    expect(pageErrors).toEqual([]);

    const polyfillInstalledAtRuntime = await page
      .evaluate(() => {
        return (
          (typeof WebGLRenderingContext !== 'undefined' &&
            typeof (WebGLRenderingContext.prototype as any).texElementImage2D === 'function') ||
          (typeof WebGL2RenderingContext !== 'undefined' &&
            typeof (WebGL2RenderingContext.prototype as any).texElementImage2D === 'function')
        );
      })
      .catch(() => false);

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
      polyfillInstalledAtRuntime ||
      /typeof\s+[^;]*texElementImage2D|\brequestPaint['"]?\s+in\b|!gl\.texElementImage2D|if\s*\(\s*gl\.texElementImage2D\s*\)|three-html-render|installHtmlInCanvasPolyfill/i.test(
        code
      );
    expect(hasFallbackStrategy).toBe(true);
  });

});
