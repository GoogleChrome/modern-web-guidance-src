import test, { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer-core';

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

function regexToStringParts(regex: RegExp) {
  const match = regex.toString().match(/^\/(.*)\/([gimy]*)$/);
  if (!match) return { pattern: regex.source, flags: '' };
  return { pattern: match[1], flags: match[2] };
}

describe(`Invoker Commands API Expectations: ${demoName}`, () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await puppeteer.launch({
      executablePath: getChromePath(),
      headless: true,
    });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      try {
        const url = new URL(request.url());
        if (url.origin === 'http://localhost') {
          const requestPath = url.pathname;
          const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);
          
          if (fs.existsSync(localFilePath)) {
            const contentType = getContentType(localFilePath);
            request.respond({
              status: 200,
              contentType: contentType,
              body: fs.readFileSync(localFilePath),
            });
          } else {
            request.continue();
          }
        } else {
          request.continue();
        }
      } catch (err) {
        console.error('Interception error:', err);
        request.abort();
      }
    });

    await page.goto(demoUrl);
  });

  afterEach(async () => {
    await page.close();
  });

  function getContentType(filePath: string): string {
    const ext = path.extname(filePath);
    switch (ext) {
      case '.html': return 'text/html';
      case '.css': return 'text/css';
      case '.js': return 'application/javascript';
      case '.json': return 'application/json';
      default: return 'application/octet-stream';
    }
  }

  async function findButtonByText(page: Page, textRegex: RegExp): Promise<ElementHandle<HTMLButtonElement> | null> {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent || '', btn);
      if (textRegex.test(text.trim())) {
        return btn as ElementHandle<HTMLButtonElement>;
      }
    }
    return null;
  }

  async function assertHasClass(page: Page, selector: string, className: string) {
    try {
      await page.waitForFunction(
        (sel, cls) => {
          const el = document.querySelector(sel);
          return el ? el.classList.contains(cls) : false;
        },
        { timeout: 2000 },
        selector,
        className
      );
    } catch (e) {
      const actualClassList = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? Array.from(el.classList).join(' ') : null;
      }, selector);
      assert.fail(`Expected element '${selector}' to have class '${className}', but got '${actualClassList}'`);
    }
  }

  async function assertNotHasClassesRegex(page: Page, selector: string, classRegex: RegExp) {
    const { pattern, flags } = regexToStringParts(classRegex);
    try {
      await page.waitForFunction(
        (sel, pat, flg) => {
          const el = document.querySelector(sel);
          if (!el) return true;
          const rx = new RegExp(pat, flg);
          return !Array.from(el.classList).some(cls => rx.test(cls));
        },
        { timeout: 2000 },
        selector,
        pattern,
        flags
      );
    } catch (e) {
      const actualClassList = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? Array.from(el.classList).join(' ') : null;
      }, selector);
      assert.fail(`Expected element '${selector}' to NOT match classes '${classRegex}', but got '${actualClassList}'`);
    }
  }

  it('Buttons use commandfor and command attributes', async () => {
    const buttonData = await page.$$eval('button[commandfor][command]', (buttons) => {
      return buttons.map(b => b.getAttribute('command'));
    });
    
    assert.ok(buttonData.length >= 4, `Expected at least 4 buttons, got ${buttonData.length}`);
    for (const cmd of buttonData) {
      assert.ok(cmd && cmd.startsWith('--'), `Expected command to start with '--', got '${cmd}'`);
    }
  });

  it('Invoker Commands API is available (natively or via polyfill)', async () => {
    await page.waitForFunction(() => 'commandForElement' in HTMLButtonElement.prototype, { timeout: 5000 });
    
    const isAvailable = await page.evaluate(() => 'commandForElement' in HTMLButtonElement.prototype);
    assert.strictEqual(isAvailable, true, 'Invoker Commands API is not available');

    const invokerButton = await page.waitForSelector('button[commandfor]', { visible: true, timeout: 5000 });
    assert.ok(invokerButton, 'Expected to find a visible button with commandfor attribute');
  });

  it('Clicking Spin toggles is-spun class on target element', async () => {
    const btn = await findButtonByText(page, /Spin/i);
    assert.ok(btn, 'Spin button not found');
    const targetId = await page.evaluate(el => el.getAttribute('commandfor'), btn);
    assert.ok(targetId, 'commandfor attribute not found on Spin button');
    
    await btn.click();
    await assertHasClass(page, `#${targetId}`, 'is-spun');
  });

  it('Clicking Grow toggles is-grown class on target element', async () => {
    const btn = await findButtonByText(page, /Grow/i);
    assert.ok(btn, 'Grow button not found');
    const targetId = await page.evaluate(el => el.getAttribute('commandfor'), btn);
    assert.ok(targetId, 'commandfor attribute not found on Grow button');
    
    await btn.click();
    await assertHasClass(page, `#${targetId}`, 'is-grown');
  });

  it('Clicking Make Round toggles is-rounded class on target element', async () => {
    const btn = await findButtonByText(page, /Make Round/i);
    assert.ok(btn, 'Make Round button not found');
    const targetId = await page.evaluate(el => el.getAttribute('commandfor'), btn);
    assert.ok(targetId, 'commandfor attribute not found on Make Round button');
    
    await btn.click();
    await assertHasClass(page, `#${targetId}`, 'is-rounded');
  });

  it('Clicking Reset All removes all transformation classes', async () => {
    // Setup: Apply all transformations first
    const spinBtn = await findButtonByText(page, /Spin/i);
    assert.ok(spinBtn, 'Spin button not found');
    await spinBtn.click();

    const growBtn = await findButtonByText(page, /Grow/i);
    assert.ok(growBtn, 'Grow button not found');
    await growBtn.click();

    const roundBtn = await findButtonByText(page, /Make Round/i);
    assert.ok(roundBtn, 'Make Round button not found');
    await roundBtn.click();

    const resetBtn = await findButtonByText(page, /Reset All/i);
    assert.ok(resetBtn, 'Reset All button not found');
    const targetId = await page.evaluate(el => el.getAttribute('commandfor'), resetBtn);
    assert.ok(targetId, 'commandfor attribute not found on Reset All button');

    // Verify they are applied first
    await assertHasClass(page, `#${targetId}`, 'is-spun');
    await assertHasClass(page, `#${targetId}`, 'is-grown');
    await assertHasClass(page, `#${targetId}`, 'is-rounded');

    await resetBtn.click();
    await assertNotHasClassesRegex(page, `#${targetId}`, /is-spun|is-grown|is-rounded/);
  });
});
