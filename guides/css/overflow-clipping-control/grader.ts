import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetPath = process.env.TARGET_FILE;
if (!targetPath) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetPath);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe('Overflow Clipping Control Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);
      if (localFilePath.endsWith('.html') || localFilePath.endsWith('.css') || localFilePath.endsWith('.js')) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  });

  test('The layout container applies overflow: clip to clip content without creating a scroll container', async ({ page }) => {
    await page.goto(demoUrl);
    const style = await page.evaluate(() => {
      const el = document.querySelector('.nested-curve-parent') || document.querySelector('.safety-zone-parent');
      if (!el) return null;
      const comp = window.getComputedStyle(el);
      return {
        overflow: comp.overflow,
        overflowX: comp.overflowX,
        overflowY: comp.overflowY,
      };
    });

    expect(style).not.toBeNull();
    const hasClip = style?.overflow === 'clip' || style?.overflowX === 'clip' || style?.overflowY === 'clip';
    expect(hasClip).toBe(true);
  });

  test('The container applies a box-edge keyword to overflow-clip-margin to align the clipping boundary with the inner box edge', async ({ page }) => {
    await page.goto(demoUrl);
    const hasBoxEdge = await page.evaluate(() => {
      const el = document.querySelector('.nested-curve-parent');
      if (!el) return false;
      const comp = window.getComputedStyle(el);
      const val = comp.overflowClipMargin || comp.getPropertyValue('overflow-clip-margin') || '';
      return ['content-box', 'padding-box', 'border-box'].some(kw => val.includes(kw));
    });
    expect(hasBoxEdge).toBe(true);
  });

  test('The container applies an offset length to overflow-clip-margin to establish an extended safety zone for child decorations', async ({ page }) => {
    await page.goto(demoUrl);
    const isLength = await page.evaluate(() => {
      const el = document.querySelector('.safety-zone-parent');
      if (!el) return false;
      const comp = window.getComputedStyle(el);
      // overflow-clip-margin is ignored unless overflow is clip
      if (comp.overflowX !== 'clip' && comp.overflowY !== 'clip') return false;
      const px = (comp.overflowClipMargin || '').match(/(\d+(?:\.\d+)?)px/);
      return Boolean(px && parseFloat(px[1]) > 0);
    });
    expect(isLength).toBe(true);
  });
});
