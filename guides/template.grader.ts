import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup (always include)
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}
const filePath = path.resolve(targetFile);
const demoUrl = `file://${filePath}`;
const demoName = path.basename(filePath);

// Tests
test.describe(`<guide-name> Expectations: ${demoName}`, () => {
    // Static assertions
    test(`<test-case-name>`, async () => {
      const html = fs.readFileSync(filePath, 'utf-8');
      // assertions: expect ...
    });

    // ...

    // Browser assertions
    test.beforeEach(async ({ page }) => {
      await page.goto(demoUrl);
      // ...
    });

    test(`<test-case-name>`, async ({ page }) => {
      // assertions: expect ...
    });

    // ...
});
