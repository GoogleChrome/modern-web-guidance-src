import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Document } from 'linkedom';

const currentFileUrl =
  typeof __filename !== 'undefined'
    ? pathToFileURL(__filename).href
    : pathToFileURL(path.join(process.cwd(), 'grader.ts')).href;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

const COPY_BUTTON_SELECTOR = [
  '.card button[command^="--"]',
  '.card button[commandfor]',
  'button[command^="--copy"]',
  '.card button.copy-button',
  '.card .copy button',
  '.card button[aria-label*="copy" i]',
].join(', ');

test.describe('copy-button Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('Each copy button is a <button> with type="button"', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const buttons = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll(COPY_BUTTON_SELECTOR)),
    );
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const btn of buttons) {
      expect(btn.tagName.toLowerCase()).toBe('button');
      expect(btn.getAttribute('type')).toBe('button');
    }
  });

  test('Each copy button has a command attribute whose value starts with -- and a commandfor attribute that references the id of an existing element', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const entries = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll(COPY_BUTTON_SELECTOR)).map((btn) => ({
        doc: d.document,
        btn,
      })),
    );
    expect(entries.length).toBeGreaterThanOrEqual(3);
    for (const { doc, btn } of entries) {
      const command = btn.getAttribute('command');
      const commandfor = btn.getAttribute('commandfor');
      expect(command).toBeTruthy();
      expect(command!.startsWith('--')).toBe(true);
      expect(commandfor).toBeTruthy();
      expect(doc.getElementById(commandfor!)).not.toBeNull();
    }
  });

  test('The live region is not a descendant of any copy button', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const buttons = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll(COPY_BUTTON_SELECTOR)),
    );
    const liveRegions = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('[role="status"], [role="alert"], [aria-live]')),
    );
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    expect(liveRegions.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      const nestedLiveRegion = btn.querySelector('[role="status"], [role="alert"], [aria-live]');
      expect(nestedLiveRegion).toBeNull();
    }
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.addInitScript(() => {
        const w = window as unknown as {
          __copiedTexts: string[];
          __shouldFailCopy: boolean;
        };
        w.__copiedTexts = [];
        w.__shouldFailCopy = false;

        const mockWriteText = async (text: string) => {
          if (w.__shouldFailCopy) {
            throw new DOMException('Write permission denied', 'NotAllowedError');
          }
          w.__copiedTexts.push(String(text));
        };

        try {
          if (navigator.clipboard) {
            Object.defineProperty(navigator.clipboard, 'writeText', {
              value: mockWriteText,
              configurable: true,
              writable: true,
            });
          } else {
            Object.defineProperty(navigator, 'clipboard', {
              value: { writeText: mockWriteText },
              configurable: true,
            });
          }
        } catch {
          try {
            Object.defineProperty(Clipboard.prototype, 'writeText', {
              value: mockWriteText,
              configurable: true,
              writable: true,
            });
          } catch {
            // ignore
          }
        }

        const origExecCommand = document.execCommand?.bind(document);
        document.execCommand = function (commandId: string, ...args: unknown[]) {
          if (String(commandId).toLowerCase() === 'copy') {
            if (w.__shouldFailCopy) {
              return false;
            }
            const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
            const selected =
              active && typeof active.value === 'string'
                ? active.value
                : window.getSelection()?.toString() || '';
            w.__copiedTexts.push(selected);
            return true;
          }
          return origExecCommand ? origExecCommand(commandId, ...(args as [boolean?, string?])) : false;
        };
      });

      await page.goto(TARGET_URL);
    });

    test('Clicking a copy button for a non-input element writes the rendered text content of its commandfor target to the clipboard (navigator.clipboard.writeText)', async ({
      page,
    }) => {
      const btn = page.locator(COPY_BUTTON_SELECTOR).first();
      await expect(btn).toHaveCount(1);

      const expectedText = await btn.evaluate((el) => {
        const id = el.getAttribute('commandfor');
        const target = id ? document.getElementById(id) : null;
        return target ? target.innerText.trim() : '';
      });
      expect(expectedText.length).toBeGreaterThan(0);

      await btn.click({ force: true });

      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1) ?? null,
          ),
        )
        .toBe(expectedText);
    });

    test('When the commandfor target is a text <input> or <textarea>, clicking the button copies its current value', async ({
      page,
    }) => {
      const btn = page.locator(COPY_BUTTON_SELECTOR).first();
      await expect(btn).toHaveCount(1);

      const expectedValue = 'Custom brew notes: 18g in, 36g out';

      await btn.evaluate((el, val) => {
        const origId = el.getAttribute('commandfor') || 'temp-copy-input';
        const origTarget = document.getElementById(origId);
        if (origTarget) origTarget.removeAttribute('id');

        const input = document.createElement('input');
        input.type = 'text';
        input.id = origId;
        input.value = val;
        // Ensure scripts that fall back to innerText on target still read the current value
        // if they haven't matched input/textarea, while scripts that check .value read input.value directly.
        Object.defineProperty(input, 'innerText', {
          get() {
            return input.value;
          },
          configurable: true,
        });
        document.body.appendChild(input);
      }, expectedValue);

      await btn.click({ force: true });

      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1) ?? null,
          ),
        )
        .toBe(expectedValue);
    });

    test('When the commandfor target is a multi-line code block, the copied text preserves its line breaks', async ({
      page,
    }) => {
      const btn = page.locator(COPY_BUTTON_SELECTOR).first();
      await expect(btn).toHaveCount(1);

      const multilineCode = 'const grind = "fine";\nconst dose = 18;\nconst yieldGrams = 36;';

      await btn.evaluate((el, codeText) => {
        const id = el.getAttribute('commandfor');
        const origTarget = id ? document.getElementById(id) : null;
        if (origTarget) origTarget.removeAttribute('id');

        const pre = document.createElement('pre');
        const code = document.createElement('code');
        if (id) code.id = id;
        code.textContent = codeText;
        pre.appendChild(code);
        document.body.appendChild(pre);
      }, multilineCode);

      await btn.click({ force: true });

      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as { __copiedTexts: string[] }).__copiedTexts.at(-1) ?? null,
          ),
        )
        .toBe(multilineCode);
    });

    test('Every copy button has a non-empty accessible name that is exposed in the accessibility tree even when the button shows only an icon', async ({
      page,
    }) => {
      const buttons = page.locator(COPY_BUTTON_SELECTOR);
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        await expect(btn).toHaveAccessibleName(/\S+/);
        const hasHiddenOrNoText = await btn.evaluate((el) => {
          const ariaLabel = el.getAttribute('aria-label')?.trim() || '';
          const ariaLabelledBy = el.getAttribute('aria-labelledby')?.trim() || '';
          const visibleText = el.textContent?.trim() || '';
          return Boolean(ariaLabel || ariaLabelledBy || visibleText);
        });
        expect(hasHiddenOrNoText).toBe(true);
      }
    });

    test('A live region (role="status" or aria-live) exists on the page, and its text becomes non-empty after a successful copy', async ({
      page,
    }) => {
      const liveRegions = page.locator('[role="status"], [role="alert"], [aria-live]');
      expect(await liveRegions.count()).toBeGreaterThan(0);

      const btn = page.locator(COPY_BUTTON_SELECTOR).first();
      await expect(btn).toHaveCount(1);
      await btn.click({ force: true });

      await expect
        .poll(() =>
          page.evaluate(() => {
            const regions = Array.from(
              document.querySelectorAll('[role="status"], [role="alert"], [aria-live]'),
            );
            return regions.map((r) => (r.textContent || '').trim()).find((t) => t.length > 0) || '';
          }),
        )
        .not.toBe('');
    });

    test('When the clipboard write fails, the live region reports a failure message', async ({
      page,
    }) => {
      await page.evaluate(() => {
        (window as unknown as { __shouldFailCopy: boolean }).__shouldFailCopy = true;
      });

      const btn = page.locator(COPY_BUTTON_SELECTOR).first();
      await expect(btn).toHaveCount(1);
      await btn.click({ force: true });

      await expect
        .poll(() =>
          page.evaluate(() => {
            const regions = Array.from(
              document.querySelectorAll('[role="status"], [role="alert"], [aria-live]'),
            );
            return regions.map((r) => (r.textContent || '').trim()).find((t) => t.length > 0) || '';
          }),
        )
        .toMatch(/fail|error|unable|denied|could not|couldn't/i);
    });

    test('When the clipboard write fails, the clicked button does not gain its copied state', async ({
      page,
    }) => {
      await page.evaluate(() => {
        (window as unknown as { __shouldFailCopy: boolean }).__shouldFailCopy = true;
      });

      const btn = page.locator(COPY_BUTTON_SELECTOR).first();
      await expect(btn).toHaveCount(1);
      await btn.click({ force: true });

      // Wait until failure feedback is processed (live region updated or next frame)
      await expect
        .poll(() =>
          page.evaluate(() => {
            const regions = Array.from(
              document.querySelectorAll('[role="status"], [role="alert"], [aria-live]'),
            );
            return regions.some((r) => (r.textContent || '').trim().length > 0);
          }),
        )
        .toBe(true);

      const hasCopiedState = await btn.evaluate((el) => {
        return (
          el.hasAttribute('data-copied') ||
          el.getAttribute('data-state') === 'copied' ||
          el.classList.contains('copied') ||
          el.classList.contains('is-copied')
        );
      });
      expect(hasCopiedState).toBe(false);
    });

    test('Each visible copy button is at least 24 by 24 CSS pixels', async ({ page }) => {
      const buttons = page.locator(COPY_BUTTON_SELECTOR);
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(24);
        expect(box!.height).toBeGreaterThanOrEqual(24);
      }
    });

    test('After a successful copy the clicked button gains a visual copied state (such as a data-copied attribute or class) that is removed again after a timeout', async ({
      page,
    }) => {
      await page.evaluate(() => {
        const origSetTimeout = window.setTimeout.bind(window);
        window.setTimeout = ((
          handler: TimerHandler,
          timeout?: number,
          ...args: unknown[]
        ): number => {
          const capped = typeof timeout === 'number' && timeout >= 500 ? 250 : timeout;
          return origSetTimeout(handler, capped, ...args);
        }) as typeof window.setTimeout;
      });

      const btn = page.locator(COPY_BUTTON_SELECTOR).first();
      await expect(btn).toHaveCount(1);
      await btn.click({ force: true });

      const hasCopiedState = () =>
        btn.evaluate((el) => {
          return (
            el.hasAttribute('data-copied') ||
            el.getAttribute('data-state') === 'copied' ||
            el.classList.contains('copied') ||
            el.classList.contains('is-copied')
          );
        });

      await expect.poll(hasCopiedState).toBe(true);
      await expect.poll(hasCopiedState, { timeout: 5000 }).toBe(false);
    });
  });
});
