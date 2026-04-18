import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe(`Scroll Snap Realtime Feedback Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto('http://localhost/');
  });

  test('The implementation uses scrollsnapchanging', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/addEventListener\s*\(\s*['"`]scrollsnapchanging['"`]/i);
  });

  test('The implementation uses scrollsnapchange', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/addEventListener\s*\(\s*['"`]scrollsnapchange['"`]/i);
  });

  test('The gallery contains child elements with class ".gallery-item", one per photo', async ({ page }) => {
    const items = page.locator('.gallery-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('The number of .thumbnail elements must equal the number of .gallery-item elements', async ({ page }) => {
    const thumbnails = page.locator('.thumbnail');
    const items = page.locator('.gallery-item');
    const thumbCount = await thumbnails.count();
    const itemCount = await items.count();
    expect(thumbCount).toBeGreaterThan(0);
    expect(thumbCount).toBe(itemCount);
  });

  test('The element with class ".thumbnail" corresponding to the pending snap target receives the class "pending" during a scroll gesture', async ({ page }) => {
    const gallery = page.locator('#gallery');
    const secondThumb = page.locator('.thumbnail').nth(1);

    await gallery.evaluate(el => el.scrollLeft = 0);
    
    await gallery.evaluate(el => el.scrollBy({ left: 200, behavior: 'smooth' }));
    
    await expect(secondThumb).toHaveClass(/pending/);
  });

  test('The "pending" class is removed from previously pending thumbnails when moving to another target', async ({ page }) => {
    const gallery = page.locator('#gallery');
    const secondThumb = page.locator('.thumbnail').nth(1);
    const thirdThumb = page.locator('.thumbnail').nth(2);

    await gallery.evaluate(el => el.scrollLeft = 0);

    await gallery.evaluate(el => el.scrollBy({ left: 400, behavior: 'smooth' }));
    await expect(secondThumb).toHaveClass(/pending/);
    
    await expect(secondThumb).toHaveClass(/active/);

    await gallery.evaluate(el => el.scrollBy({ left: 400, behavior: 'smooth' }));
    await expect(thirdThumb).toHaveClass(/pending/);
    await expect(secondThumb).not.toHaveClass(/pending/);
  });

  test('The element with class ".thumbnail" corresponding to the final snap target receives the class "active" after the scroll gesture completes', async ({ page }) => {
    const secondThumb = page.locator('.thumbnail').nth(1);
    const secondItem = page.locator('.gallery-item').nth(1);

    await page.locator('#gallery').evaluate(el => el.scrollLeft = 0);
    
    await secondItem.evaluate(el => el.scrollIntoView({ behavior: 'auto', inline: 'center' }));
    
    await expect(secondThumb).toHaveClass(/active/);
  });

  test('The element with class ".thumbnail" corresponding to the final snap target does not have the class "pending" after the scroll gesture completes', async ({ page }) => {
    const secondThumb = page.locator('.thumbnail').nth(1);
    const secondItem = page.locator('.gallery-item').nth(1);

    await page.locator('#gallery').evaluate(el => el.scrollLeft = 0);
    await secondItem.evaluate(el => el.scrollIntoView({ behavior: 'auto', inline: 'center' }));
    
    await expect(secondThumb).toHaveClass(/active/);
    await expect(secondThumb).not.toHaveClass(/pending/);
  });
});
