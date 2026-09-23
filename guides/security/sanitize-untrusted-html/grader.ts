import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

const TEST_PAYLOAD = `<p class="blue-text">Safe text with <b>bold</b>.</p>
<script>window.__xssExecuted = true;</script>
<img src="x" onerror="window.__xssExecuted = true">
<div style="color: blue;" onclick="window.__xssExecuted = true">Styled div with click handler</div>`;

test.describe('Sanitize Untrusted HTML Expectations', () => {
  test.beforeEach(async ({ page, TARGET_URL }) => {
    await page.route('**/*purify*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          const DOMPurify = {
            sanitize(html, config) {
              window.__domPurifyCalled = true;
              if (config) {
                window.__domPurifyConfigs = window.__domPurifyConfigs || [];
                window.__domPurifyConfigs.push(config);
              }
              return '<p class="blue-text">Safe text with <b>bold</b>.</p>Styled div with click handler';
            }
          };
          export default DOMPurify;
          export const sanitize = DOMPurify.sanitize;
        `,
      });
    });

    if (demoName !== 'index.html' || TARGET_URL.startsWith('http://localhost/')) {
      await page.route(`${TARGET_URL.replace(/\/$/, '')}/**`, async (route) => {
        const requestUrl = new URL(route.request().url());
        const requestPath = requestUrl.pathname;
        const localFilePath =
          requestPath === '/' || requestPath === `/${demoName}`
            ? filePath
            : path.join(targetDir, requestPath);

        if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }

    await page.addInitScript(() => {
      (window as any).__setHTMLCalled = false;
      (window as any).__setHTMLWithSanitizer = false;
      (window as any).__sanitizerConfigs = [];
      (window as any).__domPurifyCalled = false;
      (window as any).__domPurifyConfigs = [];
      (window as any).__xssExecuted = false;

      const OriginalSanitizer = (window as any).Sanitizer;
      if (OriginalSanitizer) {
        (window as any).Sanitizer = class extends OriginalSanitizer {
          constructor(config?: any) {
            super(config);
            (window as any).__sanitizerConfigs.push(config || {});
          }
        };
      } else {
        (window as any).Sanitizer = class MockSanitizer {
          config: any;
          constructor(config?: any) {
            this.config = config || {};
            (window as any).__sanitizerConfigs.push(this.config);
          }
        };
      }

      const originalSetHTML = (Element.prototype as any).setHTML;
      Object.defineProperty(Element.prototype, 'setHTML', {
        configurable: true,
        writable: true,
        value: function (html: string, options?: any) {
          (window as any).__setHTMLCalled = true;
          if (options && options.sanitizer) {
            (window as any).__setHTMLWithSanitizer = true;
          }
          if (typeof originalSetHTML === 'function') {
            return originalSetHTML.call(this, html, options);
          }
          // Polyfill behavior if browser build lacks native setHTML
          const temp = document.createElement('template');
          temp.innerHTML = html;
          temp.content.querySelectorAll('script, img').forEach((el) => el.remove());
          temp.content.querySelectorAll('*').forEach((el) => {
            Array.from(el.attributes).forEach((attr) => {
              if (attr.name.startsWith('on') || attr.name === 'style') {
                el.removeAttribute(attr.name);
              }
            });
          });
          if (options?.sanitizer) {
            temp.content.querySelectorAll('div').forEach((div) => {
              div.replaceWith(...Array.from(div.childNodes));
            });
          }
          this.replaceChildren(temp.content);
        },
      });
    });
  });

  async function triggerSanitization(page: any, url: string) {
    await page.goto(url);
    const input = page.locator('[data-testid="review-input"], #untrusted-input, textarea').first();
    const button = page.locator('[data-testid="preview-button"], #btn-run, button').first();
    await input.fill(TEST_PAYLOAD);
    await button.click();
  }

  test('Untrusted HTML is sanitized and inserted into the target container using `Element.prototype.setHTML()` (or a sanitized fallback when unsupported) rather than raw `innerHTML`.', async ({
    page,
    TARGET_URL,
  }) => {
    await triggerSanitization(page, TARGET_URL);

    const setHTMLCalled = await page.evaluate(() => Boolean((window as any).__setHTMLCalled));
    expect(setHTMLCalled).toBe(true);
  });

  test('The rendered output container does not contain any `<script>` elements when given input containing `<script>` tags.', async ({
    page,
    TARGET_URL,
  }) => {
    await triggerSanitization(page, TARGET_URL);

    const result = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="review-output"], #output-custom');
      if (!container) return { hasContainer: false, scriptCount: -1, childCount: 0 };
      return {
        hasContainer: true,
        scriptCount: container.querySelectorAll('script').length,
        childCount: container.children.length,
      };
    });

    expect(result.hasContainer).toBe(true);
    expect(result.childCount).toBeGreaterThan(0);
    expect(result.scriptCount).toBe(0);
  });

  test('The rendered output container does not contain any inline `on*` event handler attributes (such as `onclick` or `onerror`) on any descendant elements.', async ({
    page,
    TARGET_URL,
  }) => {
    await triggerSanitization(page, TARGET_URL);

    const result = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="review-output"], #output-custom');
      if (!container) return { hasContainer: false, hasInlineEvents: true, elementCount: 0 };
      const elements = Array.from(container.querySelectorAll('*'));
      const hasInlineEvents = elements.some((el) =>
        Array.from(el.attributes).some((attr) => attr.name.toLowerCase().startsWith('on'))
      );
      return {
        hasContainer: true,
        hasInlineEvents,
        elementCount: elements.length,
      };
    });

    expect(result.hasContainer).toBe(true);
    expect(result.elementCount).toBeGreaterThan(0);
    expect(result.hasInlineEvents).toBe(false);
  });

  test('A custom `Sanitizer` configuration restricts allowed elements to basic formatting tags (such as `p`, `b`, `i`, `strong`, `em`) and strips disallowed elements such as `<img>`.', async ({
    page,
    TARGET_URL,
  }) => {
    await triggerSanitization(page, TARGET_URL);

    const result = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="review-output"], #output-custom');
      const configs = (window as any).__sanitizerConfigs || [];
      const hasFormattingAllowlist = configs.some(
        (cfg: any) =>
          Array.isArray(cfg?.elements) &&
          cfg.elements.includes('p') &&
          cfg.elements.includes('b') &&
          !cfg.elements.includes('img')
      );
      return {
        hasFormattingAllowlist,
        imgCount: container ? container.querySelectorAll('img').length : -1,
        pCount: container ? container.querySelectorAll('p').length : 0,
      };
    });

    expect(result.hasFormattingAllowlist).toBe(true);
    expect(result.pCount).toBeGreaterThan(0);
    expect(result.imgCount).toBe(0);
  });

  test('The custom `Sanitizer` configuration uses `replaceWithChildrenElements` (e.g., `[\'div\']`) so wrapper `<div>` tags are removed while preserving their inner text/child nodes in the rendered container.', async ({
    page,
    TARGET_URL,
  }) => {
    await triggerSanitization(page, TARGET_URL);

    const result = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="review-output"], #output-custom');
      const configs = (window as any).__sanitizerConfigs || [];
      const hasReplaceWithChildren = configs.some(
        (cfg: any) =>
          Array.isArray(cfg?.replaceWithChildrenElements) &&
          cfg.replaceWithChildrenElements.includes('div')
      );
      return {
        hasReplaceWithChildren,
        divCount: container ? container.querySelectorAll('div').length : -1,
        text: container?.textContent || '',
      };
    });

    expect(result.hasReplaceWithChildren).toBe(true);
    expect(result.divCount).toBe(0);
    expect(result.text).toContain('Styled div with click handler');
  });

  test('Allowed elements and attributes (such as `<p class="...">` and `<b>`) are preserved in the rendered output container.', async ({
    page,
    TARGET_URL,
  }) => {
    await triggerSanitization(page, TARGET_URL);

    const result = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="review-output"], #output-custom');
      if (!container) return { hasPWithClass: false, hasBold: false, hasDisallowedStyle: true };
      const pEl = container.querySelector('p.blue-text');
      const bEl = container.querySelector('b');
      const hasDisallowedStyle = Array.from(container.querySelectorAll('*')).some((el) =>
        el.hasAttribute('style')
      );
      return {
        hasPWithClass: Boolean(pEl),
        hasBold: Boolean(bEl && bEl.textContent === 'bold'),
        hasDisallowedStyle,
      };
    });

    expect(result.hasPWithClass).toBe(true);
    expect(result.hasBold).toBe(true);
    expect(result.hasDisallowedStyle).toBe(false);
  });

  test('When `Element.prototype.setHTML` or `Sanitizer` is unavailable in the browser, the implementation conditionally loads and falls back to `DOMPurify.sanitize()` with matching allowed elements and attributes.', async ({
    page,
    TARGET_URL,
  }) => {
    await page.addInitScript(() => {
      delete (Element.prototype as any).setHTML;
      delete (window as any).Sanitizer;
      delete (Document as any).parseHTML;
    });

    await triggerSanitization(page, TARGET_URL);

    await expect
      .poll(async () => {
        return page.evaluate(() => Boolean((window as any).__domPurifyCalled));
      })
      .toBe(true);

    const configMatch = await page.evaluate(() => {
      const configs = (window as any).__domPurifyConfigs || [];
      return configs.some(
        (cfg: any) =>
          Array.isArray(cfg?.ALLOWED_TAGS) &&
          cfg.ALLOWED_TAGS.includes('p') &&
          cfg.ALLOWED_TAGS.includes('b') &&
          Array.isArray(cfg?.ALLOWED_ATTR) &&
          cfg.ALLOWED_ATTR.includes('class')
      );
    });

    expect(configMatch).toBe(true);
  });
});
