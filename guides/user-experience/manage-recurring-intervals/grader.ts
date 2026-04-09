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
const fileContent = fs.readFileSync(filePath, 'utf-8');

// Tests
test.describe(`Temporal Interval Manager Expectations`, () => {

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
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); 
  });

  test(`MUST feature-detect the Temporal API`, async () => {
    const hasFeatureDetect = fileContent.includes('typeof Temporal') || fileContent.includes('typeof window.Temporal');
    expect(hasFeatureDetect).toBe(true);
  });

  test(`MUST conditionally load a Temporal polyfill`, async () => {
    const hasPolyfillLoad = fileContent.includes('@js-temporal/polyfill');
    expect(hasPolyfillLoad).toBe(true);
  });

  test(`MUST manually assign the loaded polyfill to globalThis.Temporal`, async () => {
    const assignsGlobal = fileContent.includes('globalThis.Temporal =') || fileContent.includes('window.Temporal =');
    expect(assignsGlobal).toBe(true);
  });

  test(`MUST use Temporal.PlainDate`, async () => {
    const usesPlainDate = fileContent.includes('Temporal.PlainDate');
    expect(usesPlainDate).toBe(true);
  });

  test(`MUST use the .add() method`, async () => {
    const usesAdd = fileContent.includes('.add(');
    expect(usesAdd).toBe(true);
  });

  test(`MUST provide a way to configure the overflow strategy`, async ({ page }) => {
    const htmlContent = await page.content();
    const hasOverflowControl = htmlContent.toLowerCase().includes('constrain') && htmlContent.toLowerCase().includes('reject');
    expect(hasOverflowControl).toBe(true);
  });

  test(`MUST correctly handle the 'constrain' overflow strategy`, async ({ page }) => {
    await page.fill('input[type="date"], #startDateInput', '2024-01-31');
    const monthsInput = page.locator('#monthsInput, input[type="number"]').nth(1);
    if (await monthsInput.count() > 0) {
        await monthsInput.fill('1');
    }

    const selectCount = await page.locator('select').count();
    if (selectCount > 0) {
       try {
           await page.locator('select').selectOption({ value: 'constrain' });
       } catch (e) {
           const select = page.locator('select');
           const options = await select.locator('option').allInnerTexts();
           const constrainOption = options.find(opt => opt.toLowerCase().includes('constrain'));
           if (constrainOption) {
               await select.selectOption({ label: constrainOption });
           }
       }
    }
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    const resultText = await page.locator('#resultDate, .huge-value').first().textContent();
    expect(resultText?.trim()).toContain('2024-02-29');
  });

  test(`MUST correctly handle the 'reject' overflow strategy`, async ({ page }) => {
    await page.fill('input[type="date"], #startDateInput', '2024-01-31');
    const monthsInput = page.locator('#monthsInput, input[type="number"]').nth(1);
    if (await monthsInput.count() > 0) {
        await monthsInput.fill('1');
    }

    let rejectSelected = false;
    const selectCount = await page.locator('select').count();
    if (selectCount > 0) {
       try {
           await page.locator('select').selectOption({ value: 'reject' });
           rejectSelected = true;
       } catch (e) {
           const select = page.locator('select');
           const options = await select.locator('option').allInnerTexts();
           const rejectOption = options.find(opt => opt.toLowerCase().includes('reject'));
           if (rejectOption) {
               await select.selectOption({ label: rejectOption });
               rejectSelected = true;
           }
       }
    }
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    const resultText = await page.locator('#resultDate, .huge-value').first().textContent();
    const isErrorText = Boolean(resultText?.toLowerCase().includes('error') || resultText?.toLowerCase().includes('rangeerror'));
    
    expect(isErrorText).toBe(true);
  });

  test(`MUST NOT attempt to modify Temporal instances directly`, async () => {
    const hasDirectMutation = fileContent.includes('.year =') || fileContent.includes('.month =') || fileContent.includes('.day =');
    const hasLegacyMutation = fileContent.includes('.setFullYear(') || fileContent.includes('.setMonth(') || fileContent.includes('.setDate(');
    expect(!hasDirectMutation && !hasLegacyMutation).toBe(true);
  });

  test(`MUST NOT use the legacy Date object`, async () => {
    const usesLegacyDate = fileContent.includes('new Date(');
    expect(usesLegacyDate).toBe(false);
  });

});