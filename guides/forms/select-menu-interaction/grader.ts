import { test, expect, type Locator } from '@playwright/test';
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

// Helper function
async function isErrorVisible(locator: Locator) {
  return await locator.evaluate((el) => {
    const elementsToCheck = [el];
    let parent = el.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      if (parent.tagName === 'DIV' || parent.classList.length > 0) {
        elementsToCheck.push(parent);
      }
      parent = parent.parentElement;
    }

    for (const e of elementsToCheck) {
      if (e.matches(':user-invalid') || e.classList.contains('user-invalid') || e.classList.contains('user-invalid-fallback')) {
        return true;
      }
      const styles = window.getComputedStyle(e);
      const colors = [styles.borderColor, styles.borderLeftColor, styles.outlineColor, styles.backgroundColor];
      for (const color of colors) {
        const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          if (r > g + 40 && r > b + 40) return true;
        }
      }
    }
    return false;
  });
}

// Tests
test.describe(`Select Menu Interaction Expectations: ${demoName}`, () => {
  // Static assertions
  test(`CSS MUST use :user-invalid pseudo-class for validation styling`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);
  });

  test(`CSS MUST NOT use basic :invalid pseudo-class that triggers immediately`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/select\s*:invalid\s*[,{]/i);
  });

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

    // Prevent form submission from reloading the page so we can check error state
    await page.evaluate(() => {
      document.querySelector('form')?.addEventListener('submit', (e) => e.preventDefault());
    });
  });

  // Browser assertions
  test(`On page load, the select menu should look neutral`, async ({ page }) => {
    const select = page.locator('select').first();
    const isRed = await isErrorVisible(select);
    expect(isRed).toBe(false);
  });

  test(`Selecting a valid option MUST remove the error state`, async ({ page }) => {
    const select = page.locator('select').first();
    
    // Check initial state
    const initialRed = await isErrorVisible(select);
    
    // Trigger error state by trying to submit
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:not([type="button"])');
    if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
    } else {
        await page.evaluate(() => document.querySelector('form')?.requestSubmit());
    }
    const triggeredRed = await isErrorVisible(select);
    
    // Select valid option
    let validValue = null;
    const options = select.locator('option');
    for (let i = 0; i < await options.count(); i++) {
        const val = await options.nth(i).getAttribute('value');
        if (val && val.trim() !== '') { 
            validValue = val; 
            break; 
        }
    }
    
    if (validValue) {
        await select.selectOption(validValue);
    }
    const finalRed = await isErrorVisible(select);
    
    // We check the transition explicitly to ensure negative demos fail if they started off wrong
    expect(`initial:${initialRed}, triggered:${triggeredRed}, final:${finalRed}`).toBe('initial:false, triggered:true, final:false');
  });

  test(`Submitting while empty MUST trigger the error state`, async ({ page }) => {
    const select = page.locator('select').first();
    const initialRed = await isErrorVisible(select);
    
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:not([type="button"])');
    if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
    } else {
        await page.evaluate(() => document.querySelector('form')?.requestSubmit());
    }
    
    const afterSubmitRed = await isErrorVisible(select);
    
    // We check both initial and after state to fail the negative demo
    expect(`initial:${initialRed}, afterSubmit:${afterSubmitRed}`).toBe('initial:false, afterSubmit:true');
  });
});
