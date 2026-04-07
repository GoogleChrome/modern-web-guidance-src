import { test, expect } from '@playwright/test';

// @ts-ignore
import * as fs from 'fs';
// @ts-ignore
import * as path from 'path';

declare const process: any;

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;
const fileContent = fs.readFileSync(filePath, 'utf-8');

test.describe(`Temporal Duration Expectations: ${demoName}`, () => {

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

  test('MUST feature-detect the Temporal API using typeof Temporal === \'undefined\' before usage', async () => {
    expect(fileContent).toMatch(/typeof\s+Temporal\s*===\s*['"`]undefined['"`]/);
  });

  test('MUST conditionally load a Temporal polyfill', async () => {
    expect(fileContent).toMatch(/@js-temporal\/polyfill/);
  });

  test('MUST manually assign the loaded polyfill to globalThis.Temporal', async () => {
    expect(fileContent).toMatch(/globalThis\.Temporal\s*=\s*/);
  });

  test('MUST use Temporal.Duration.from() to create duration objects', async () => {
    expect(fileContent).toMatch(/Temporal\.Duration\.from\s*\(/);
  });

  test('MUST use the .round() method on Temporal.Duration instances with a largestUnit option', async () => {
    expect(fileContent).toMatch(/\.round\s*\(\s*\{\s*largestUnit/);
  });

  test('MUST extract individual unit properties from the Temporal.Duration instance', async () => {
    expect(fileContent).toMatch(/\.(hours|minutes|seconds)(?!\s*=)/);
  });

  test('MUST NOT rely on Temporal.Duration.prototype.toString() for user-facing text', async ({ page }) => {
    expect(fileContent).toMatch(/\$\{[^}]*\.(hours|minutes|seconds)[^}]*\}|\+\s*[^+\n]*\.(hours|minutes|seconds)/);
  });

  test('MUST NOT assume Temporal.Duration automatically localizes strings for the user', async ({ page }) => {
    const inputs = page.locator('input[type="number"]');
    if (await inputs.count() >= 1) {
      await inputs.first().fill('2');
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).toMatch(/2\s*hours?/i);
    }
  });

  test('MUST NOT attempt to modify Temporal.Duration instances directly', async () => {
    // Negative demo: duration.hours = balancedHours
    expect(fileContent).not.toMatch(/\.(hours|minutes|seconds)\s*=/);
  });

  test('MUST NOT use legacy manual calculations for duration balancing', async () => {
    // Negative demo uses % 60 or / 3600
    expect(fileContent).not.toMatch(/%\s*60/);
    expect(fileContent).not.toMatch(/\/\s*3600/);
  });

});
