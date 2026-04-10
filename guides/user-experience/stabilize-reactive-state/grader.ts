// @ts-nocheck
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

// Tests
test.describe(`Stabilize Reactive State Expectations: ${demoName}`, () => {

  // Setup browser testing
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
  });

  test(`MUST feature-detect the Temporal API before usage`, async ({ page }) => {
    const content = await page.content();
    const hasFeatureDetection = /typeof\s+Temporal\s*===\s*['"`]undefined['"`]|!globalThis\.Temporal/.test(content);
    expect(hasFeatureDetection).toBe(true);
  });

  test(`MUST conditionally load a Temporal polyfill or have feature detection`, async ({ page }) => {
    const content = await page.content();
    const hasFeatureDetection = /typeof\s+Temporal\s*===\s*['"`]undefined['"`]|!globalThis\.Temporal/.test(content);
    expect(hasFeatureDetection).toBe(true);
  });

  test(`MUST use Temporal.PlainDateTime (or specific Temporal type) and update it immutably`, async ({ page }) => {
    const content = await page.content();
    const usesTemporal = /Temporal\.(PlainDateTime|Now\.plainDateTimeISO|PlainDate)/.test(content);
    const usesImmutableUpdate = /\.(add|subtract|with)\s*\(/.test(content);
    expect(usesTemporal && usesImmutableUpdate).toBe(true);
  });

  test(`MUST assign the new Temporal instance reference to the state`, async ({ page }) => {
    const content = await page.content();
    const hasAssignment = /=\s*.*\.(add|subtract|with)\s*\(/.test(content);
    expect(hasAssignment).toBe(true);
  });

  test(`MUST NOT attempt to modify properties of a Temporal instance directly`, async ({ page }) => {
    const content = await page.content();
    const hasDirectMutation = /\.(hour|minute|second|day|month|year)\s*([+\-*/]?=|\+\+|--)/.test(content);
    expect(hasDirectMutation).toBe(false);
  });

});
