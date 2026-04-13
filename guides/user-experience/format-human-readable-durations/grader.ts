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

test.describe(`Temporal Duration Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Intercept requests to serve local files
    await page.route('http://localhost/*', async (route) => {
      const url = new URL(route.request().url());
      const requestPath = url.pathname;
      
      if (requestPath === '/' || requestPath === `/${demoName}`) {
        if (fs.existsSync(filePath)) {
          await route.fulfill({ path: filePath });
          return;
        }
      }

      const localFilePath = path.join(process.cwd(), requestPath);
      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        const nodeModulesPath = path.join(process.cwd(), 'node_modules', requestPath);
        if (fs.existsSync(nodeModulesPath)) {
            await route.fulfill({ path: nodeModulesPath });
        } else {
            await route.continue();
        }
      }
    });

    await page.goto(demoUrl);
  });

  test('The implementation MUST feature-detect Temporal using "typeof Temporal === \'undefined\'"', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).toContain("typeof Temporal === 'undefined'");
  });

  test('The implementation MUST conditionally load the polyfill using dynamic import()', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).toMatch(/import\(.*temporal.*polyfill.*\)/);
  });

  test('The implementation MUST assign the polyfill to globalThis.Temporal', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).toContain('globalThis.Temporal');
  });

  test('The implementation MUST use Temporal.Duration.from() to create duration objects', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).toContain('Temporal.Duration.from');
  });

  test('The implementation MUST NOT use "new Temporal.Duration()" directly', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).not.toContain('new Temporal.Duration');
  });

  test('The implementation MUST use the .round() method for balancing', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).toContain('.round');
  });

  test('The implementation MUST specify largestUnit when rounding', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).toContain('largestUnit');
  });

  test('The implementation MUST NOT use legacy manual division (e.g. / 60) for unit balancing', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).not.toMatch(/Math\.floor\(.*\/ 60\)/);
  });

  test('The implementation MUST NOT use legacy manual modulo (e.g. % 60) for unit balancing', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).not.toMatch(/% 60/);
  });

  test('The implementation MUST produce localized human-readable output (NOT ISO 8601 strings)', async ({ page }) => {
    const outputText = await page.evaluate(() => {
        const possibleOutputs = [
            document.getElementById('humanValue'),
            document.getElementById('output'),
            document.querySelector('.huge-value'),
            document.querySelector('.result')
        ];
        return possibleOutputs.find(e => e !== null)?.textContent?.trim() || '';
    });
    const isoPattern = /PT(\d+H)?(\d+M)?(\d+S)?/;
    expect(outputText).not.toMatch(isoPattern);
  });

  test('The implementation MUST use time unit words like "minute" or "hour" in the user-facing output', async ({ page }) => {
    const outputText = await page.evaluate(() => {
        const possibleOutputs = [
            document.getElementById('humanValue'),
            document.getElementById('output'),
            document.querySelector('.huge-value'),
            document.querySelector('.result')
        ];
        return possibleOutputs.find(e => e !== null)?.textContent?.trim() || '';
    });
    expect(outputText.toLowerCase()).toMatch(/minute|hour|second/);
  });

  test('The implementation MUST NOT attempt to modify Temporal.Duration instances (which are immutable)', async ({ page }) => {
    const scripts = await page.locator('script').allInnerTexts();
    const allScripts = scripts.join('\n');
    expect(allScripts).not.toMatch(/\.hours\s*=/);
  });

});
