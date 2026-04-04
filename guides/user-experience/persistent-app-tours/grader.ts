import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Persistent App Tours Expectations: ${demoName}`, () => {

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

    await page.goto(demoUrl);
    // wait for layout
    await page.waitForTimeout(100);
  });

  test(`1. The tour step popover must not close when the user clicks on the element it is highlighting.`, async ({ page }) => {
    const tourStep = page.locator('#tour-step');
    await expect(tourStep).toBeVisible();
    await page.locator('#feature').click();
    await expect(tourStep).toBeVisible();
  });

  test(`2. The popover must remain in the Top Layer, ensuring it is never obscured by other elements.`, async ({ page }) => {
    // Check if it's opened natively via popover API
    const isPopoverOpen = await page.evaluate(() => {
      const el = document.getElementById('tour-step');
      if (!el) return false;
      try {
        return el.matches(':popover-open');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'SyntaxError') {
          return false; // Browser does not support :popover-open
        }
        throw e;
      }
    });
    expect(isPopoverOpen).toBe(true);
  });

  test(`3. The tour step must correctly follow the anchor element if the window is resized.`, async ({ page }) => {
    const tourStep = page.locator('#tour-step');
    const initialBox = await tourStep.boundingBox();
    expect(initialBox).not.toBeNull();

    // Move the feature element
    await page.evaluate(() => {
      const feature = document.getElementById('feature');
      if (feature) {
        feature.style.marginTop = '200px';
        feature.style.marginLeft = '200px';
      }
    });

    // Wait a bit for layout to update
    await page.waitForTimeout(100);

    const newBox = await tourStep.boundingBox();
    expect(newBox).not.toBeNull();

    // The tour step should have moved
    expect(newBox!.x).not.toBeCloseTo(initialBox!.x);
    expect(newBox!.y).not.toBeCloseTo(initialBox!.y);
  });

  test(`4. The popover must only close when the user clicks the explicit "Next" or "Close" button.`, async ({ page }) => {
    const tourStep = page.locator('#tour-step');
    await expect(tourStep).toBeVisible();
    
    // Click outside the popover and the feature
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await expect(tourStep).toBeVisible();

    // Find a button inside the tour step
    const button = tourStep.locator('button');
    await button.click();
    
    await expect(tourStep).not.toBeVisible();
  });

});
