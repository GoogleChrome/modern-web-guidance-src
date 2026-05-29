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
    return 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe';
  }
  return 'google-chrome';
}

describe(`Anchor Positioning Tab Underline Expectations: ${demoName}`, () => {
  let browser: Browser;
  let page: Page;

  test.before(async () => {
    browser = await puppeteer.launch({
      executablePath: getChromePath(),
      headless: true,
    });
  });

  test.after(async () => {
    if (browser) {
      await browser.close();
    }
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

          await route.respond({
            status: 200,
            contentType,
            body,
          });
        } else {
          await route.continue();
        }
      } catch (err) {
        console.error('Request interception error:', err);
        try { await route.abort(); } catch {}
      }
    });

    await page.goto(demoUrl);

    // Inject navigation prevention
    await page.evaluate(() => {
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'A' || target.closest('a')) {
          e.preventDefault();
        }
      }, true);
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  const getBeforeData = async (page: Page) => {
    return await page.evaluate(() => {
      const ul = document.querySelector('ul');
      const li = document.querySelector('li.active');
      if (!ul || !li) return null;

      const style = window.getComputedStyle(ul, '::before');
      const liRect = li.getBoundingClientRect();

      const content = style.content;
      const isRendered = content !== 'none' && content !== 'normal' && content !== '';

      let cb: HTMLElement | Element = ul;
      while (cb && cb !== document.documentElement) {
        const cbStyle = window.getComputedStyle(cb);
        if (cbStyle.position !== 'static' || cbStyle.transform !== 'none' || cbStyle.perspective !== 'none' || cbStyle.containerType !== 'normal') {
          break;
        }
        if (cb.parentElement) {
          cb = cb.parentElement;
        } else {
          break;
        }
      }
      if (!cb) cb = document.documentElement;

      const cbRect = cb.getBoundingClientRect();
      const cbStyle = window.getComputedStyle(cb);
      const top = parseFloat(style.top) || 0;
      const left = parseFloat(style.left) || 0;
      const width = parseFloat(style.width) || 0;
      const height = parseFloat(style.height) || 0;

      return {
        isRendered,
        content: style.content,
        width,
        height,
        left: cbRect.left + (parseFloat(cbStyle.borderLeftWidth) || 0) + left,
        top: cbRect.top + (parseFloat(cbStyle.borderTopWidth) || 0) + top,
        rawLeft: style.left,
        rawTop: style.top,
        liRect: {
          left: liRect.left,
          top: liRect.top,
          width: liRect.width,
          height: liRect.height,
          bottom: liRect.bottom,
          right: liRect.right
        },
        transition: style.transition
      };
    });
  };

  test('There is an underline element visible under the active tab item.', async () => {
    const data = await getBeforeData(page);
    assert.ok(data);
    assert.strictEqual(data.isRendered, true);
    assert.ok(data.height > 0);
    assert.ok(data.width > 0);
    assert.ok(data.top >= data.liRect.bottom - 2);
  });

  test('The underline element is the width of the active tab item.', async () => {
    const data = await getBeforeData(page);
    assert.ok(data);
    assert.strictEqual(data.isRendered, true);
    assert.ok(Math.abs(data.width - data.liRect.width) < 1.5);
  });

  test("The underline element's inline start edge is aligned to the active tab item's inline start edge.", async () => {
    const data = await getBeforeData(page);
    assert.ok(data);
    assert.strictEqual(data.isRendered, true);
    assert.notStrictEqual(data.rawLeft, 'auto');
    assert.ok(Math.abs(data.left - data.liRect.left) < 1.5);
  });

  test("The underline element's inline end edge is aligned to the active tab item's inline end edge.", async () => {
    const data = await getBeforeData(page);
    assert.ok(data);
    assert.strictEqual(data.isRendered, true);
    const pseudoRight = data.left + data.width;
    assert.ok(Math.abs(pseudoRight - data.liRect.right) < 1.5);
  });

  test("The underline element's block start edge is positioned below the block end edge of the active tab item.", async () => {
    const data = await getBeforeData(page);
    assert.ok(data);
    assert.strictEqual(data.isRendered, true);
    assert.ok(data.top >= data.liRect.bottom - 2);
  });

  test('Changing the active page moves the underline element to be positioned underneath the new active tab item.', async () => {
    const tabs = await page.$$('ul li');
    assert.ok(tabs.length > 1);

    // Click the second tab
    await tabs[1].click();
    await new Promise(resolve => setTimeout(resolve, 300)); // Wait for transition

    const data = await getBeforeData(page);
    assert.ok(data);
    assert.strictEqual(data.isRendered, true);
    assert.ok(Math.abs(data.width - data.liRect.width) < 1.5);
    assert.ok(Math.abs(data.left - data.liRect.left) < 1.5);
  });

  test('When prefers-reduced-motion: reduce is enabled, there is no animation.', async () => {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.reload();

    const data = await getBeforeData(page);
    assert.ok(data);
    assert.strictEqual(data.isRendered, true);
    assert.ok(!data.transition.includes('inset'));
  });

  test('When prefers-reduced-motion: no-preference is enabled, the underline animates.', async () => {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.reload();

    const data = await getBeforeData(page);
    assert.ok(data);
    assert.strictEqual(data.isRendered, true);
    assert.ok(data.transition.includes('inset'));
    assert.ok(!data.transition.includes('inset 0s'));
  });

  test('The underline is created using a ::before pseudo-element on the <ul>.', async () => {
     const data = await getBeforeData(page);
     assert.ok(data);
     assert.strictEqual(data.isRendered, true);
  });
});
