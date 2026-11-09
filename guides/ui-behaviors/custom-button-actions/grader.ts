import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

const invokersPolyfillStub = `
class CommandEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.command = init.command || '';
    this.source = init.source || null;
  }
}
globalThis.CommandEvent = CommandEvent;
if (!('commandForElement' in HTMLButtonElement.prototype)) {
  Object.defineProperty(HTMLButtonElement.prototype, 'commandForElement', {
    configurable: true,
    get() {
      const id = this.getAttribute('commandfor');
      return id ? document.getElementById(id) : null;
    },
    set(el) {
      if (el?.id) this.setAttribute('commandfor', el.id);
    },
  });
}
if (!('command' in HTMLButtonElement.prototype)) {
  Object.defineProperty(HTMLButtonElement.prototype, 'command', {
    configurable: true,
    get() {
      return this.getAttribute('command') || '';
    },
    set(val) {
      this.setAttribute('command', val);
    },
  });
}
document.addEventListener('click', (e) => {
  const btn = e.target?.closest?.('button[commandfor][command]');
  if (!btn) return;
  const target = btn.commandForElement;
  if (!target) return;
  target.dispatchEvent(new CommandEvent('command', { command: btn.command, source: btn }));
});
export { CommandEvent };
export default {};
`;

async function routeLocalFiles(page: import('@playwright/test').Page) {
  await page.route('http://localhost/**', async (route) => {
    const requestPath = new URL(route.request().url()).pathname;
    const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
      const isJs = /\.(m?js|cjs)$/i.test(localFilePath);
      await route.fulfill({
        path: localFilePath,
        ...(isJs ? { contentType: 'application/javascript' } : {}),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe(`Invoker Commands API Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await routeLocalFiles(page);
    await page.goto(demoUrl);
  });

  test('Buttons use commandfor and command attributes', async ({ page }) => {
    const buttons = page.locator('button[commandfor][command]');
    const count = await buttons.count();
    // Verify we have at least the required 4 buttons (Spin, Grow, Round, Reset)
    expect(count).toBeGreaterThanOrEqual(4);
    
    for (let i = 0; i < count; i++) {
      const cmd = await buttons.nth(i).getAttribute('command');
      expect(cmd).toMatch(/^--/);
    }
  });


  test('Invoker Commands API is available (natively or via polyfill)', async ({ page, browser }) => {
    const invokerButton = page.locator('button[commandfor]');
    await expect(invokerButton.first()).toBeVisible();

    const fallbackContext = await browser.newContext();
    const fallbackPage = await fallbackContext.newPage();
    try {
      await routeLocalFiles(fallbackPage);
      await fallbackPage.route(
        /https?:\/\/(?:esm\.run|esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)\/.*invokers-polyfill.*/,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: invokersPolyfillStub,
          });
        }
      );
      await fallbackPage.addInitScript(() => {
        delete (HTMLButtonElement.prototype as any).commandForElement;
        delete (HTMLButtonElement.prototype as any).command;
        delete (window as any).CommandEvent;
        window.addEventListener(
          'command',
          (event) => {
            if (event.isTrusted) {
              event.stopImmediatePropagation();
            }
          },
          true
        );
      });

      await fallbackPage.goto(demoUrl, { waitUntil: 'networkidle' });
      await fallbackPage.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      );

      const spinBtn = fallbackPage.getByRole('button', { name: /Spin/i });
      const targetId = await spinBtn.getAttribute('commandfor');
      expect(targetId).toBeTruthy();

      const target = fallbackPage.locator(`#${targetId}`);
      await spinBtn.click();
      await expect(target).toHaveClass(/is-spun/);
    } finally {
      await fallbackContext.close();
    }
  });

  test('Clicking Spin toggles is-spun class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Spin/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-spun/);
  });

  test('Clicking Grow toggles is-grown class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Grow/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-grown/);
  });

  test('Clicking Make Round toggles is-rounded class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Make Round/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-rounded/);
  });

  test('Clicking Reset All removes all transformation classes', async ({ page }) => {
    // Setup: Apply all transformations first
    await page.getByRole('button', { name: /Spin/i }).click();
    await page.getByRole('button', { name: /Grow/i }).click();
    await page.getByRole('button', { name: /Make Round/i }).click();

    const btn = page.getByRole('button', { name: /Reset All/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    // Use a single assertion to verify no state-specific classes remain
    await expect(target).not.toHaveClass(/is-spun|is-grown|is-rounded/);
  });

});
