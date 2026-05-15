import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import puppeteer from 'puppeteer-core';
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

function getChromePath() {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (process.platform === 'win32') {
    return 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe';
  }
  return 'google-chrome';
}

describe(`Accessible Error Announcement Expectations: ${demoName}`, () => {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;

  before(async () => {
    browser = await puppeteer.launch({
      executablePath: getChromePath(),
      headless: true,
    });
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      try {
        const url = new URL(request.url());
        if (url.origin === 'http://localhost') {
          const requestPath = url.pathname;
          const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);
          if (fs.existsSync(localFilePath)) {
            const ext = path.extname(localFilePath).toLowerCase();
            let contentType = 'text/html';
            if (ext === '.css') contentType = 'text/css';
            if (ext === '.js') contentType = 'application/javascript';
            
            const body = await fs.promises.readFile(localFilePath);
            await request.respond({
              status: 200,
              contentType,
              body,
            });
          } else {
            await request.continue();
          }
        } else {
          await request.continue();
        }
      } catch (err) {
        try {
          await request.continue();
        } catch (_) {}
      }
    });

    await page.goto(demoUrl);
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test(`The aria-invalid attribute must NOT be present (or set to false) on page load`, async () => {
    const selector = 'input[type="email"], input[name="email"], #email';
    const input = await page.waitForSelector(selector);
    if (!input) throw new Error('Input not found');
    
    const ariaInvalid = await page.evaluate(el => el.getAttribute('aria-invalid'), input);
    assert.ok(['false', null].includes(ariaInvalid));
  });

  test(`Tabbing through a field without typing should NOT trigger aria-invalid="true"`, async () => {
    const selector = 'input[type="email"], input[name="email"], #email';
    const input = await page.waitForSelector(selector);
    if (!input) throw new Error('Input not found');

    await input.focus();
    await page.evaluate(el => el.blur(), input);
    
    const ariaInvalid = await page.evaluate(el => el.getAttribute('aria-invalid'), input);
    assert.ok(['false', null].includes(ariaInvalid));
  });

  test(`Typing an invalid value and blurring MUST set aria-invalid="true"`, async () => {
    const selector = 'input[type="email"], input[name="email"], #email';
    const input = await page.waitForSelector(selector);
    if (!input) throw new Error('Input not found');

    await page.evaluate(el => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, input);
    await input.type('bad-email');
    await page.evaluate(el => el.blur(), input);
    
    const ariaInvalid = await page.evaluate(el => el.getAttribute('aria-invalid'), input);
    assert.ok(ariaInvalid === 'true' || ariaInvalid === '');
  });

  test(`Correcting the value to a valid format MUST remove the aria-invalid attribute immediately on input`, async () => {
    const selector = 'input[type="email"], input[name="email"], #email';
    const input = await page.waitForSelector(selector);
    if (!input) throw new Error('Input not found');

    // Make it invalid first
    await page.evaluate(el => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, input);
    await input.type('bad-email');
    await page.evaluate(el => el.blur(), input);
    
    const stateBefore = await page.evaluate(el => el.getAttribute('aria-invalid'), input);
    
    // Correct it
    await input.focus();
    await page.evaluate(el => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, input);
    await input.type('test@example.com');
    
    const stateAfter = await page.evaluate(el => el.getAttribute('aria-invalid'), input);
    
    const isBeforeInvalid = stateBefore === 'true' || stateBefore === '';
    const isAfterValid = stateAfter === 'false' || stateAfter === null || stateAfter === undefined;
    assert.ok(isBeforeInvalid && isAfterValid);
  });

  test(`The visual error message visibility must match the aria-invalid state`, async () => {
    const selector = 'input[type="email"], input[name="email"], #email';
    const input = await page.waitForSelector(selector);
    if (!input) throw new Error('Input not found');
    
    // Make it invalid
    await page.evaluate(el => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, input);
    await input.type('bad-email');
    await page.evaluate(el => el.blur(), input);

    const matches = await page.evaluate((el: any) => {
      const attr = el.getAttribute('aria-invalid');
      const ariaInvalid = attr === 'true' || attr === '';

      let errMsg: HTMLElement | null = null;
      
      const errId = el.getAttribute('aria-errormessage');
      if (errId) {
        errMsg = document.getElementById(errId);
      }
      
      if (!errMsg) {
        const sibling = el.nextElementSibling as HTMLElement;
        if (sibling && (sibling.classList.contains('error-message') || sibling.classList.contains('error-msg'))) {
          errMsg = sibling;
        }
      }

      if (!errMsg) {
        const parent = el.parentElement;
        if (parent) {
          errMsg = parent.querySelector('.error-message, .error-msg') as HTMLElement;
        }
      }

      if (!errMsg) {
        return false;
      }

      const style = window.getComputedStyle(errMsg);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

      return ariaInvalid === isVisible;
    }, input);

    assert.strictEqual(matches, true);
  });
});
