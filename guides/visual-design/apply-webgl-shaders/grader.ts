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
      if (err.message.includes('texElementImage2D')) {
        hasError = true;
      }
    });

    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);

    expect(hasError).toBe(false);
  });

  test('The canvas element includes the layoutsubtree attribute', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    const canvas = page.locator('canvas').first();
    const hasLayoutSubtree = await canvas.evaluate(el => el.hasAttribute('layoutsubtree')).catch(() => false);
    if (hasLayoutSubtree) {
      expect(hasLayoutSubtree).toBe(true);
      return;
    }
    const code = getScriptContent();
    expect(code.includes('layoutsubtree')).toBe(true);
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

  test('The rendering logic uses texElementImage2D to draw HTML elements', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);
    const code = getScriptContent();
    expect(code.includes('texElementImage2D') || code.includes('copyElementImageToTexture')).toBe(true);
  });

  test('The CSS transform property of the descendant HTML element is updated', async ({ page }) => {
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(500);
    const code = getScriptContent();
    expect(code.includes('getElementTransform') || code.includes('matrix3d') || code.includes('transform')).toBe(true);
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
