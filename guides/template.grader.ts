import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function runTests(filePath: string, isNegative: boolean = false) {
  const demoUrl = `file://${filePath}`;
  const demoName = path.basename(filePath);

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
      if (isNegative) {
        // if negative assertions are needed
      }
    });

    // ...
  });
}

// Always include this block
const targetFile = process.env.TARGET_FILE;

if (targetFile) {
  runTests(path.resolve(targetFile));
} else {
  runTests(path.join(__dirname, 'demo.html'));
  runTests(path.join(__dirname, 'negative-demo.html'), true);
}
