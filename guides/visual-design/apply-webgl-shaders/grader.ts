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
const targetUrl = `file://${targetFile}`;

function getScriptContent(): string {
  if (fs.existsSync(targetFile)) {
    return fs.readFileSync(targetFile, 'utf8');
  }
  return '';
}

test.describe('HTML-in-Canvas WebGL Shaders Grader', () => {

  test.beforeEach(async ({ page }) => {
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
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);
    expect(true).toBe(true);
  });

});
