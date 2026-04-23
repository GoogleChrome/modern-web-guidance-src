import { test, expect } from './test-fixture.ts';
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

// Tests
test.describe(`<guide-name> Expectations: ${demoName}`, () => {

  // Setup browser testing
  test.beforeEach(async ({ page, TARGET_URL }) => {
    // Only mock local routes if it's a file-based demo, else let the dev server handle it
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

  // Browser assertions
  test(`<test-case-name>`, async ({ page }) => {
    // ... expect ...
  });

  // ...
});
