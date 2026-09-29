import {
  test,
  expect,
  getTargetFiles,
} from '../../../../test-fixture.ts';
import type { Page, Locator } from '@playwright/test';

const targetFiles: string[] = getTargetFiles(import.meta.url);

async function navigateToCommentPage(page: Page, targetUrl: string): Promise<void> {
  const hasArticlePage = targetFiles.some((f) => f.includes('articles/'));
  const articleUrl = new URL('articles/silent-architects', targetUrl).href;

  if (hasArticlePage) {
    await page.goto(articleUrl);
    try {
      await page.locator('textarea').waitFor({ state: 'attached', timeout: 3000 });
      return;
    } catch {
      // Fall through to targetUrl if not found on article page
    }
  }

  await page.goto(targetUrl);
  try {
    await page.locator('textarea').waitFor({ state: 'attached', timeout: 3000 });
  } catch {
    await page.goto(articleUrl);
    await page.locator('textarea').waitFor({ state: 'attached', timeout: 3000 });
  }
}

async function renderUntrustedHtml(page: Page, html: string): Promise<Locator> {
  const textarea = page.locator('textarea');
  await textarea.waitFor({ state: 'attached', timeout: 5000 });
  await textarea.fill(html);

  const previewBtn = page.getByRole('button', { name: /preview/i });
  if (await previewBtn.count() > 0) {
    await previewBtn.click();
  }

  const outputContainer = page
    .locator('#output, [role="region"], form [data-testid="comment-output"], [data-testid="preview"], #preview')
    .first();
  await outputContainer.waitFor({ state: 'attached', timeout: 5000 });
  return outputContainer;
}

test.describe('sanitize-untrusted-html Target Grader', () => {

  test.describe('Default environment', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await navigateToCommentPage(page, TARGET_URL);
    });

    test('After untrusted HTML containing a <script> element is rendered, the output container contains no <script> elements', async ({ page }) => {
      const output = await renderUntrustedHtml(
        page,
        '<p>Valid paragraph</p><script>window.__xss1 = true;</script>'
      );

      await output.locator('p', { hasText: 'Valid paragraph' }).waitFor({ state: 'attached', timeout: 5000 });

      await expect(output.locator('script')).toHaveCount(0);
    });

    test('After untrusted HTML containing inline event handlers is rendered, no element in the output container has an on* attribute', async ({ page }) => {
      const output = await renderUntrustedHtml(
        page,
        '<p onclick="window.__xss2=true">Paragraph with handler</p><b onmouseover="window.__xss2=true">Bold text</b>'
      );

      await output.locator('p', { hasText: 'Paragraph with handler' }).waitFor({ state: 'attached', timeout: 5000 });

      const onAttributesCount = await output.evaluate((container) => {
        const allElements = [container, ...Array.from(container.querySelectorAll('*'))];
        return allElements.filter((el) =>
          Array.from(el.attributes).some((attr) => attr.name.toLowerCase().startsWith('on'))
        ).length;
      });

      expect(onAttributesCount).toBe(0);
    });

    test('Rendering untrusted HTML does not execute any script from the input (no dialogs open and no console messages are logged by the injected markup)', async ({ page }) => {
      let scriptExecuted = false;

      page.on('dialog', async (dialog) => {
        scriptExecuted = true;
        await dialog.dismiss();
      });

      page.on('console', (msg) => {
        if (msg.text().includes('XSS_PAYLOAD')) {
          scriptExecuted = true;
        }
      });

      const output = await renderUntrustedHtml(
        page,
        '<p>Safe content</p><script>console.log("XSS_PAYLOAD_SCRIPT"); alert("XSS_PAYLOAD_SCRIPT");</script><img src="missing-image.png" onerror="console.log(\'XSS_PAYLOAD_EVENT\'); alert(\'XSS_PAYLOAD_EVENT\');">'
      );

      await output.locator('p', { hasText: 'Safe content' }).waitFor({ state: 'attached', timeout: 5000 });
      await page.waitForTimeout(200);

      expect(scriptExecuted).toBe(false);
    });

    test('Safe formatting markup in the input (such as a <p> containing a <b> element) is rendered as elements in the output container, not as escaped text', async ({ page }) => {
      const output = await renderUntrustedHtml(
        page,
        '<p>Safe formatting with <b>bold text</b> inside</p>'
      );

      await expect(output.locator('p b')).toHaveText('bold text');
    });
  });

  test.describe('Fallback environment when setHTML is unavailable', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        delete (Element.prototype as any).setHTML;
      });
      await navigateToCommentPage(page, TARGET_URL);
    });

    test('When Element.prototype.setHTML is removed before the page scripts run, the output container still contains no <script> elements and no on* attributes after rendering untrusted HTML', async ({ page }) => {
      const output = await renderUntrustedHtml(
        page,
        '<p onclick="window.__xss5=true">Fallback paragraph</p><script>window.__xss5=true;</script><b onmouseover="window.__xss5=true">Fallback bold</b>'
      );

      await output.locator('p', { hasText: 'Fallback paragraph' }).waitFor({ state: 'attached', timeout: 5000 });

      const unsafeCount = await output.evaluate((container) => {
        const scriptCount = container.querySelectorAll('script').length;
        const allElements = [container, ...Array.from(container.querySelectorAll('*'))];
        const onAttrCount = allElements.filter((el) =>
          Array.from(el.attributes).some((attr) => attr.name.toLowerCase().startsWith('on'))
        ).length;
        return scriptCount + onAttrCount;
      });

      expect(unsafeCount).toBe(0);
    });
  });
});
