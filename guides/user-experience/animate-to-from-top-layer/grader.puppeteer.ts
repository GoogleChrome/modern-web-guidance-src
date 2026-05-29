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

describe(`Top Layer Animation Expectations (Puppeteer): ${demoName}`, () => {
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
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  test('The <dialog> element must include "overlay" and "display" in its transition properties with "allow-discrete"', async () => {
    await page.waitForSelector('dialog', { timeout: 2000 });
    const props = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      if (!dialog) return null;
      const style = window.getComputedStyle(dialog);
      return {
        transitionProperty: style.transitionProperty,
        transitionBehavior: style.transitionBehavior || (style as any).webkitTransitionBehavior
      };
    });
    assert.ok(props);
    const transitionProps = props.transitionProperty.split(',').map(p => p.trim());
    assert.ok(transitionProps.includes('overlay'));
    assert.ok(transitionProps.includes('display'));
    assert.ok(props.transitionBehavior.includes('allow-discrete'));
  });

  test('The [popover] element must include "overlay" and "display" in its transition properties with "allow-discrete"', async () => {
    await page.waitForSelector('[popover]', { timeout: 2000 });
    const props = await page.evaluate(() => {
      const popover = document.querySelector('[popover]');
      if (!popover) return null;
      const style = window.getComputedStyle(popover);
      return {
        transitionProperty: style.transitionProperty,
        transitionBehavior: style.transitionBehavior || (style as any).webkitTransitionBehavior
      };
    });
    assert.ok(props);
    const transitionProps = props.transitionProperty.split(',').map(p => p.trim());
    assert.ok(transitionProps.includes('overlay'));
    assert.ok(transitionProps.includes('display'));
    assert.ok(props.transitionBehavior.includes('allow-discrete'));
  });

  test('The <dialog> element must use the @starting-style at-rule', async () => {
    const hasStartingStyle = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.type === 17 || rule.constructor.name === 'CSSStartingStyleRule' || rule.cssText.includes('@starting-style')) {
              if (rule.cssText.includes('dialog')) return true;
              if ((rule as any).cssRules) {
                for (const subRule of (rule as any).cssRules) {
                  if (subRule.selectorText && subRule.selectorText.includes('dialog')) return true;
                }
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });
    assert.strictEqual(hasStartingStyle, true);
  });

  test('The [popover] element must use the @starting-style at-rule', async () => {
    const hasStartingStyle = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.type === 17 || rule.constructor.name === 'CSSStartingStyleRule' || rule.cssText.includes('@starting-style')) {
              if (rule.cssText.includes('popover')) return true;
              if ((rule as any).cssRules) {
                for (const subRule of (rule as any).cssRules) {
                  if (subRule.selectorText && subRule.selectorText.includes('popover')) return true;
                }
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });
    assert.strictEqual(hasStartingStyle, true);
  });

  test('The <dialog> element must smoothly transition when opened', async () => {
    await page.waitForSelector('dialog', { timeout: 2000 });
    const isClosed = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      return !dialog || window.getComputedStyle(dialog).display === 'none';
    });
    assert.strictEqual(isClosed, true);

    await page.click('#open-dialog-btn, #openDialog');

    const opacity = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      return dialog ? parseFloat(window.getComputedStyle(dialog).opacity) : 1;
    });
    assert.ok(opacity < 1);

    await page.waitForFunction(() => {
      const dialog = document.querySelector('dialog');
      return dialog && window.getComputedStyle(dialog).opacity === '1';
    }, { timeout: 2000 });
  });

  test('The <dialog> element must smoothly transition when closed', async () => {
    await page.click('#open-dialog-btn, #openDialog');
    await page.waitForFunction(() => {
      const dialog = document.querySelector('dialog');
      return dialog && window.getComputedStyle(dialog).opacity === '1';
    }, { timeout: 2000 });

    await page.click('#close-dialog-btn, #closeDialog');

    await page.waitForFunction(() => {
      const dialog = document.querySelector('dialog');
      if (!dialog) return false;
      const style = window.getComputedStyle(dialog);
      return style.display !== 'none' && parseFloat(style.opacity) > 0 && parseFloat(style.opacity) < 1;
    }, { timeout: 1000 });

    await page.waitForFunction(() => {
      const dialog = document.querySelector('dialog');
      return !dialog || window.getComputedStyle(dialog).display === 'none';
    }, { timeout: 2000 });
  });

  test('The <dialog> ::backdrop must be animated', async () => {
    await page.click('#open-dialog-btn, #openDialog');
    const backdropProps = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      if (!dialog) return null;
      const style = window.getComputedStyle(dialog, '::backdrop');
      return {
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        transitionBehavior: style.transitionBehavior || (style as any).webkitTransitionBehavior
      };
    });
    assert.ok(backdropProps);
    assert.ok(/background-color|opacity|all/.test(backdropProps.transitionProperty));
    assert.ok(parseFloat(backdropProps.transitionDuration) > 0);
    assert.ok(backdropProps.transitionBehavior.includes('allow-discrete'));
  });

  test('The implementation must respect prefers-reduced-motion', async () => {
    const normalDuration = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      return dialog ? parseFloat(window.getComputedStyle(dialog).transitionDuration) : 0;
    });

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

    const reducedDuration = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      return dialog ? parseFloat(window.getComputedStyle(dialog).transitionDuration) : 0;
    });

    await page.emulateMediaFeatures([]);

    assert.ok(reducedDuration < normalDuration);
    assert.ok(reducedDuration <= 0.11);
  });
});
