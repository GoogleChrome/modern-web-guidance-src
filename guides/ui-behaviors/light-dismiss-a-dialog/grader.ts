import { test, expect, type Page } from '@playwright/test';
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

async function loadWithoutClosedBy(page: Page) {
  // Exercise the fallback selected by feature detection.
  await page.addInitScript(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'closedBy');
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => 'closedBy' in HTMLDialogElement.prototype)).toBe(false);
}

async function dispatchBackdropClick(page: Page) {
  // Synthetic events invoke fallback listeners without native light dismissal.
  // Keep closedby="any" intact for implementations that check the attribute.
  await page.locator('dialog').evaluate(el => {
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, clientX: 10, clientY: 10,
        pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
        buttons: type === 'pointerdown' ? 1 : 0,
      }));
    }
  });
}

// Tests
test.describe(`Light Dismiss Dialog Expectations: ${demoName}`, () => {

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
  });

  test('The <dialog> element must have the closedby="any" attribute', async ({ page }) => {
    const dialog = page.locator('dialog');
    await expect(dialog).toHaveAttribute('closedby', 'any');
  });

  test('The <dialog> element should have an accessible name', async ({ page }) => {
    const dialog = page.locator('dialog');
    // Check for aria-labelledby or aria-label
    const hasLabel = await dialog.evaluate(el => {
      const label = el.getAttribute('aria-label');
      const labeledBy = el.getAttribute('aria-labelledby');
      return !!(label || (labeledBy && document.getElementById(labeledBy)));
    });
    expect(hasLabel).toBe(true);
  });

  test('The dialog must be opened with showModal() when the "Open Dialog" button is clicked', async ({ page }) => {
    const openButton = page.locator('.test-dialog-trigger').first();
    const dialog = page.locator('dialog');

    await openButton.click();
    await expect(dialog).toHaveAttribute('open', '');

    // Check if it is modal (the ::backdrop exists and is visible)
    // In Playwright, we can check if it's in the top layer or if other elements are inert
    const isModal = await dialog.evaluate(el => {
      return (el as HTMLDialogElement).matches(':modal');
    });
    expect(isModal).toBe(true);
  });

  test('Clicking the backdrop must close the dialog', async ({ page }) => {
    const openButton = page.locator('.test-dialog-trigger').first();
    const dialog = page.locator('dialog');

    await openButton.click();
    await expect(dialog).toHaveAttribute('open', '');

    // Click on the backdrop (outside the dialog's content)
    // We click near the edge of the viewport
    await page.mouse.click(10, 10);
    await expect(dialog).not.toHaveAttribute('open', { timeout: 2000 });
  });

  test('Pressing the Esc key must close the dialog', async ({ page }) => {
    const openButton = page.locator('.test-dialog-trigger').first();
    const dialog = page.locator('dialog');

    await openButton.click();
    await expect(dialog).toHaveAttribute('open', '');

    await page.keyboard.press('Escape');
    await expect(dialog).not.toHaveAttribute('open', { timeout: 2000 });
  });

  test('Clicking the "Close" button inside the dialog must close the dialog', async ({ page }) => {
    const openButton = page.locator('.test-dialog-trigger').first();
    const dialog = page.locator('dialog');
    const closeButton = dialog.locator('button, a').filter({ hasText: /(Close|Cancel)/i }).first();

    await openButton.click();
    await expect(dialog).toHaveAttribute('open', '');

    await closeButton.click();
    await expect(dialog).not.toHaveAttribute('open', { timeout: 2000 });
  });

  test('Clicking inside the dialog content should NOT close the dialog', async ({ page }) => {
    const openButton = page.locator('.test-dialog-trigger').first();
    const dialog = page.locator('dialog');

    await openButton.click();
    await expect(dialog).toHaveAttribute('open', '');

    // Click on some content inside the dialog (e.g., the <h2> or <p>)
    const content = dialog.locator('h2, p').first();
    await content.click();
    await expect(dialog).toHaveAttribute('open', '');
  });

  test('The implementation should include a fallback mechanism for light-dismiss', async ({ page }) => {
    await loadWithoutClosedBy(page);
    const dialog = page.locator('dialog');
    await page.locator('.test-dialog-trigger').first().click();
    await expect(dialog).toHaveAttribute('open', '');
    await dispatchBackdropClick(page);
    await expect(dialog).not.toHaveAttribute('open');
  });

  test('When closedby is unsupported, cancel handlers can prevent backdrop dismissal', async ({ page }) => {
    await loadWithoutClosedBy(page);
    const dialog = page.locator('dialog');
    await page.locator('.test-dialog-trigger').first().click();
    await expect(dialog).toHaveAttribute('open', '');
    await dialog.evaluate(el => {
      el.addEventListener('cancel', event => {
        el.setAttribute('data-cancel-before-close', String((el as HTMLDialogElement).open));
        event.preventDefault();
      }, { once: true });
    });
    await dispatchBackdropClick(page);
    await expect(dialog).toHaveAttribute('data-cancel-before-close', 'true');
    await expect(dialog).toHaveAttribute('open', '');

    // The one-shot guard must not prevent a later, accepted dismissal.
    await dispatchBackdropClick(page);
    await expect(dialog).not.toHaveAttribute('open');
  });

});
