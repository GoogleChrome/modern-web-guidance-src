import test, { describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import puppeteer, { Browser, Page } from 'puppeteer-core';

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

describe(`autofill-address-form Expectations: ${demoName}`, () => {
  let browser: Browser;
  let page: Page;

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
            const extension = path.extname(localFilePath);
            let contentType = 'text/html';
            if (extension === '.css') contentType = 'text/css';
            else if (extension === '.js') contentType = 'application/javascript';

            const body = await fs.promises.readFile(localFilePath);
            await request.respond({
              status: 200,
              contentType,
              body,
            });
            return;
          }
        }
        await request.continue();
      } catch (err) {
        // If request is already handled or aborted, continue might throw.
        // We catch to avoid crashing.
        try {
          await request.abort();
        } catch (_) {}
      }
    });

    await page.goto(demoUrl, { waitUntil: 'domcontentloaded' });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('All form controls must be within a <form> element', async () => {
    const allInsideForm = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input, select, textarea'));
      if (controls.length === 0) return false;
      return controls.every(el => !!el.closest('form'));
    });
    assert.strictEqual(allInsideForm, true);
  });

  test('Every form control must have an associated <label>', async () => {
    const allHaveLabels = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]), select, textarea'));
      if (controls.length === 0) return false;
      return controls.every(control => {
        const id = control.id;
        return id && !!document.querySelector(`label[for="${id}"]`);
      });
    });
    assert.strictEqual(allHaveLabels, true);
  });

  test('Every <label> must have a "for" attribute matching a control "id"', async () => {
    const labelsValid = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return false;
      return labels.every(label => {
        const forAttr = label.getAttribute('for');
        const target = forAttr ? document.getElementById(forAttr) : null;
        return target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
      });
    });
    assert.strictEqual(labelsValid, true);
  });

  test('A single <textarea> must be used for the street address', async () => {
    const textareas = await page.$$('textarea');
    assert.strictEqual(textareas.length, 1);
  });

  test('The street address textarea must have autocomplete="street-address"', async () => {
    const textarea = await page.$('textarea');
    assert.ok(textarea, 'Street address textarea not found');
    const attr = await textarea.evaluate(node => node.getAttribute('autocomplete'));
    assert.ok(attr?.includes('street-address'), 'autocomplete attribute should contain street-address');
  });

  test('The postal code input must have autocomplete="postal-code"', async () => {
    const postalCodeSelector = 'input[autocomplete*="postal-code"]';
    await page.waitForSelector(postalCodeSelector, { visible: true, timeout: 2000 });
  });

  test('The postal code input must not use type="number"', async () => {
    const el = await page.$('input[autocomplete*="postal-code"]');
    assert.ok(el, 'Postal code input with autocomplete="postal-code" not found');
    const type = await el.evaluate(node => node.getAttribute('type'));
    assert.notStrictEqual(type, 'number');
  });

  test('Name and address inputs must not restrict to Latin-only characters', async () => {
    const patterns = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input[pattern], textarea[pattern]'));
      return controls.map(el => el.getAttribute('pattern')).filter(Boolean) as string[];
    });
    for (const pattern of patterns) {
      assert.ok(new RegExp(`^(?:${pattern})$`, 'u').test('Renée Müller'), `Pattern "${pattern}" restricts to Latin-only`);
    }
  });

  test('Required form fields must have the "required" attribute', async () => {
    const result = await page.evaluate(() => {
      const nameInput = document.querySelector<HTMLInputElement>('input[autocomplete*="name"]');
      const addressTextarea = document.querySelector<HTMLTextAreaElement>('textarea[autocomplete*="street-address"]');
      if (!nameInput || !addressTextarea) return false;
      return nameInput.required && addressTextarea.required;
    });
    assert.strictEqual(result, true);
  });
});
