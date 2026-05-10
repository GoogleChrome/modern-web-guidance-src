import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

type MyFixtures = {
  TARGET_URL: string;
};

const test = base.extend<MyFixtures>({
  TARGET_URL: async ({}, use) => {
    await use('http://localhost/');
  },
});

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe(`Scroll Snap Realtime Feedback Expectations`, () => {

  test.beforeEach(async ({ page, TARGET_URL }) => {
    if (TARGET_URL.startsWith('http://localhost/')) {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }

    await page.goto(TARGET_URL);
  });

  test('The gallery contains .gallery-item elements', async ({ page }) => {
    const count = await page.locator('.gallery-item').count();
    expect(count).toBeGreaterThan(0);
  });

  test('There are .thumbnail elements present', async ({ page }) => {
    const count = await page.locator('.thumbnail').count();
    expect(count).toBeGreaterThan(0);
  });

  test('The number of .thumbnail elements equals the number of .gallery-item elements', async ({ page }) => {
    const tCount = await page.locator('.thumbnail').count();
    const iCount = await page.locator('.gallery-item').count();
    expect(tCount > 0 && tCount === iCount).toBe(true);
  });

  test('The first .thumbnail becomes active when scrolling to the first gallery item', async ({ page }) => {
    const items = page.locator('.gallery-item');
    await items.first().evaluate(el => el.scrollIntoView({ behavior: 'auto', inline: 'center' }));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const gallery = document.getElementById('gallery');
      const items = document.querySelectorAll('.gallery-item');
      gallery?.dispatchEvent(new Event('scrollend'));
      const snapEvent = new Event('scrollsnapchange', { bubbles: true });
      Object.defineProperty(snapEvent, 'snapTargetInline', { value: items[0] });
      gallery?.dispatchEvent(snapEvent);
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.thumbnail').first()).toHaveClass(/active/);
  });

  test('The last .thumbnail becomes active when scrolling to the last gallery item', async ({ page }) => {
    const items = page.locator('.gallery-item');
    await items.last().evaluate(el => el.scrollIntoView({ behavior: 'smooth', inline: 'center' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const gallery = document.getElementById('gallery');
      const items = document.querySelectorAll('.gallery-item');
      gallery?.dispatchEvent(new Event('scrollend'));
      const snapEvent = new Event('scrollsnapchange', { bubbles: true });
      Object.defineProperty(snapEvent, 'snapTargetInline', { value: items[items.length - 1] });
      gallery?.dispatchEvent(snapEvent);
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.thumbnail').last()).toHaveClass(/active/);
  });

  test('The .thumbnail receives the "pending" class during a scroll gesture', async ({ page }) => {
    const gallery = page.locator('#gallery');
    await page.locator('.gallery-item').first().evaluate(el => el.scrollIntoView({ behavior: 'auto', inline: 'center' }));
    await page.waitForTimeout(500);
    const galleryBox = await gallery.boundingBox();
    if (galleryBox) {
      await page.mouse.move(galleryBox.x + galleryBox.width / 2, galleryBox.y + galleryBox.height / 2);
      await page.mouse.click(galleryBox.x + galleryBox.width / 2, galleryBox.y + galleryBox.height / 2);
      await page.mouse.wheel(150, 0);
    }
    let foundPending = false;
    for (let i = 0; i < 20; i++) {
      const hasPending = await page.evaluate(() => document.querySelectorAll('.thumbnail.pending').length > 0);
      if (hasPending) { foundPending = true; break; }
      if (galleryBox) await page.mouse.wheel(10, 0);
      await page.waitForTimeout(50);
    }
    expect(foundPending).toBe(true);
  });

  test('The second .thumbnail receives the "active" class after scrolling completes', async ({ page }) => {
    const items = page.locator('.gallery-item');
    await items.nth(1).evaluate(el => el.scrollIntoView({ behavior: 'smooth', inline: 'center' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
        const gallery = document.getElementById('gallery');
        const items = document.querySelectorAll('.gallery-item');
        gallery?.dispatchEvent(new Event('scrollend'));
        const snapEvent = new Event('scrollsnapchange', { bubbles: true });
        Object.defineProperty(snapEvent, 'snapTargetInline', { value: items[1] });
        gallery?.dispatchEvent(snapEvent);
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.thumbnail').nth(1)).toHaveClass(/active/);
  });

  test('The second .thumbnail does not have "pending" class after scrolling completes', async ({ page }) => {
    const items = page.locator('.gallery-item');
    await items.nth(1).evaluate(el => el.scrollIntoView({ behavior: 'smooth', inline: 'center' }));
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('gallery')?.dispatchEvent(new Event('scrollend')));
    await page.waitForTimeout(200);
    await expect(page.locator('.thumbnail').nth(1)).not.toHaveClass(/pending/);
  });

  test('JavaScript implementation uses a feature detection check', async ({ page }) => {
    const scriptContent = await page.evaluate(() => Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\n'));
    const hasFeatureDetection = scriptContent.includes('onscrollsnapchanging') || scriptContent.includes('scrollsnapchanging') || scriptContent.includes('in Element.prototype');
    expect(hasFeatureDetection).toBe(true);
  });

  test('Fallback implementation works when scrollsnapchanging is unsupported', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-ignore
      delete Element.prototype.onscrollsnapchanging;
      // @ts-ignore
      delete Window.prototype.onscrollsnapchanging;
      // @ts-ignore
      delete Element.prototype.onscrollsnapchange;
    });
    await page.reload();
    const gallery = page.locator('#gallery');
    const galleryBox = await gallery.boundingBox();
    if (galleryBox) {
      await page.mouse.move(galleryBox.x + galleryBox.width / 2, galleryBox.y + galleryBox.height / 2);
      await page.mouse.wheel(100, 0);
    }
    let foundPending = false;
    for (let i = 0; i < 20; i++) {
      const hasPending = await page.evaluate(() => document.querySelectorAll('.thumbnail.pending').length > 0);
      if (hasPending) { foundPending = true; break; }
      if (galleryBox) await page.mouse.wheel(10, 0);
      await page.waitForTimeout(50);
    }
    expect(foundPending).toBe(true);
  });

  test('Active thumbnail is visually highlighted', async ({ page }) => {
    await page.locator('.gallery-item').first().evaluate(el => el.scrollIntoView({ behavior: 'auto', inline: 'center' }));
    await page.evaluate(() => document.getElementById('gallery')?.dispatchEvent(new Event('scrollend')));
    await page.waitForTimeout(1000);
    const op = await page.locator('.thumbnail').first().evaluate(el => parseFloat(window.getComputedStyle(el).opacity));
    expect(op).toBeGreaterThan(0.5);
  });

  test('Gallery uses native scroll snapping', async ({ page }) => {
    const snapType = await page.locator('#gallery').evaluate(el => window.getComputedStyle(el).scrollSnapType || (window.getComputedStyle(el) as any).webkitScrollSnapType);
    expect(snapType).toMatch(/^(x|inline|both|mandatory|proximity)/);
  });
});
