import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  return 'google-chrome';
}

async function isErrorVisible(page: Page, selector: string) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
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
  }, selector);
}

describe(`Select Menu Interaction Expectations (Puppeteer): ${demoName}`, () => {
  let browser: Browser;
  let page: Page;

  test.before(async () => {
    browser = await puppeteer.launch({
      executablePath: getChromePath(),
      headless: true,
    });
  });

  test.after(async () => {
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', async (route) => {
      try {
        const requestUrl = route.url();
        const requestPath = new URL(requestUrl).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.substring(1));

        if (fs.existsSync(localFilePath)) {
          const body = await fs.promises.readFile(localFilePath);
          const extension = path.extname(localFilePath);
          let contentType = 'text/plain';
          if (extension === '.html') contentType = 'text/html';
          else if (extension === '.css') contentType = 'text/css';
          else if (extension === '.js') contentType = 'application/javascript';

          await route.respond({ status: 200, contentType, body });
        } else {
          await route.continue();
        }
      } catch (err) {
        console.error('Interception error:', err);
        try { await route.abort(); } catch {}
      }
    });

    await page.goto(demoUrl);
    await page.evaluate(() => {
      document.querySelector('form')?.addEventListener('submit', (e) => e.preventDefault());
    });
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  test(`CSS MUST use :user-invalid pseudo-class for validation styling`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    assert.ok(html.includes(':user-invalid'));
  });

  test(`CSS MUST NOT use basic :invalid pseudo-class`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    assert.ok(!/select\s*:invalid\s*[,{]/i.test(html));
  });

  test(`On page load, the select menu should look neutral`, async () => {
    await page.waitForSelector('select', { timeout: 2000 });
    const isRed = await isErrorVisible(page, 'select');
    assert.strictEqual(isRed, false);
  });

  test(`Selecting a valid option MUST remove the error state`, async () => {
    await page.waitForSelector('select', { timeout: 2000 });
    const initialRed = await isErrorVisible(page, 'select');

    const submitBtnExists = await page.evaluate(() => {
      return !!document.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');
    });

    if (submitBtnExists) {
      await page.click('button[type="submit"], input[type="submit"], button:not([type="button"])');
    } else {
      await page.evaluate(() => document.querySelector('form')?.requestSubmit());
    }

    const triggeredRed = await isErrorVisible(page, 'select');

    const validValue = await page.evaluate(() => {
      const select = document.querySelector('select');
      if (!select) return null;
      const options = Array.from(select.querySelectorAll('option'));
      for (const opt of options) {
        const val = opt.getAttribute('value');
        if (val && val.trim() !== '') return val;
      }
      return null;
    });

    if (validValue) {
      await page.select('select', validValue);
    }

    const finalRed = await isErrorVisible(page, 'select');
    assert.strictEqual(`initial:${initialRed}, triggered:${triggeredRed}, final:${finalRed}`, 'initial:false, triggered:true, final:false');
  });

  test(`Submitting while empty MUST trigger the error state`, async () => {
    await page.waitForSelector('select', { timeout: 2000 });
    const initialRed = await isErrorVisible(page, 'select');

    const submitBtnExists = await page.evaluate(() => {
      return !!document.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');
    });

    if (submitBtnExists) {
      await page.click('button[type="submit"], input[type="submit"], button:not([type="button"])');
    } else {
      await page.evaluate(() => document.querySelector('form')?.requestSubmit());
    }

    const afterSubmitRed = await isErrorVisible(page, 'select');
    assert.strictEqual(`initial:${initialRed}, afterSubmit:${afterSubmitRed}`, 'initial:false, afterSubmit:true');
  });
});
