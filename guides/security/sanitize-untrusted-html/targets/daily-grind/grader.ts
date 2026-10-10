import type { Page, Locator } from '@playwright/test';
import {
  test,
  expect,
  getTargetFiles,
} from '../../../../test-fixture.ts';

// @ts-ignore - import.meta is available in ESM runner
const _targetFiles: string[] = process.env.PATCH_FILE ? getTargetFiles(import.meta.url) : [];

function getOutputContainer(page: Page): Locator {
  return page
    .locator(
      '#output, .review-card:has(.review-meta:has-text("Anonymous")) .review-body, #reviews-list .review-card:first-child .review-body, .review-body'
    )
    .first();
}

async function renderUntrustedHtml(page: Page, html: string, markerSelector: string): Promise<Locator> {
  const input = page.locator('textarea').first();
  await input.fill(html, { timeout: 2000 });
  const submitButton = page.locator('form button').first();
  await submitButton.click({ timeout: 2000 });
  const output = getOutputContainer(page);
  await output.locator(markerSelector).first().waitFor({ timeout: 2500 });
  return output;
}

test.describe('sanitize-untrusted-html Target Grader', () => {

  test.describe('Browser tests', () => {

    test('After untrusted HTML containing a <script> element is rendered, the output container contains no <script> elements', async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      const output = await renderUntrustedHtml(
        page,
        '<p>Safe formatting <b>bold text</b></p><script>console.log("XSS");</script>',
        'b'
      );
      expect(await output.locator('script').count()).toBe(0);
    });

    test('After untrusted HTML containing inline event handlers is rendered, no element in the output container has an on* attribute', async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      const output = await renderUntrustedHtml(
        page,
        '<p onclick="alert(1)">Safe content <b onmouseover="alert(2)">hover</b> <img src="x" onerror="alert(3)"></p>',
        'b'
      );
      const onAttributes = await output.evaluate((el) =>
        [...el.querySelectorAll('*')].flatMap((node) =>
          [...node.attributes].map((attr) => attr.name.toLowerCase()).filter((name) => name.startsWith('on'))
        )
      );
      expect(onAttributes).toEqual([]);
    });

    test('Rendering untrusted HTML does not execute any script from the input', async ({ page, TARGET_URL }) => {
      const executedMessages: string[] = [];
      page.on('dialog', async (dialog) => {
        if (dialog.message().includes('PW_INJECTED')) {
          executedMessages.push(`dialog: ${dialog.message()}`);
        }
        await dialog.dismiss();
      });
      page.on('console', (message) => {
        if (message.text().includes('PW_INJECTED')) {
          executedMessages.push(`console: ${message.text()}`);
        }
      });

      await page.goto(TARGET_URL);
      const output = await renderUntrustedHtml(
        page,
        '<p onclick="window.alert(\'PW_INJECTED\')">Safe <b>text</b></p><script>console.log("PW_INJECTED"); window.alert("PW_INJECTED");</script><img src="missing.png" onerror="console.log(\'PW_INJECTED\'); window.alert(\'PW_INJECTED\');">',
        'b'
      );
      await output.locator('b').first().click();
      await page.waitForTimeout(100);

      expect(executedMessages).toEqual([]);
    });

    test('Safe formatting markup in the input is rendered as elements in the output container, not as escaped text', async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      const output = await renderUntrustedHtml(
        page,
        '<p>Formatting with <b>bold text</b> and <em>emphasis</em></p>',
        'b'
      );
      expect(await output.locator('p b').first().textContent()).toBe('bold text');
    });

    test('When Element.prototype.setHTML is removed before page scripts run, the output container contains no <script> elements and no on* attributes', async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        Reflect.deleteProperty(Element.prototype, 'setHTML');
      });
      await page.goto(TARGET_URL);
      const output = await renderUntrustedHtml(
        page,
        '<p onclick="alert(1)">Fallback <b>verified</b> <img src="x" onerror="alert(2)"></p><script>console.log("XSS");</script>',
        'b'
      );
      const unsafeCount = await output.evaluate((el) => {
        const scriptCount = el.querySelectorAll('script').length;
        const onAttrCount = [...el.querySelectorAll('*')].flatMap((node) =>
          [...node.attributes].map((attr) => attr.name.toLowerCase()).filter((name) => name.startsWith('on'))
        ).length;
        return scriptCount + onAttrCount;
      });
      expect(unsafeCount).toBe(0);
    });

  });

});
