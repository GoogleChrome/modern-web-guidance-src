import {
  test,
  expect,
  skipUnless,
  getTargetFiles,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import type { Document } from 'linkedom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

const COPY_BTN_SELECTOR = '.card button, button[command^="--"], button[commandfor]';
const LIVE_REGION_SELECTOR = '[role="status"], [role="alert"], [aria-live]';

function getCopyButtonsFromDocs(docs: Array<{ file: string; document: Document }>): any[] {
  return docs.flatMap((d) =>
    Array.from(d.document.querySelectorAll(COPY_BTN_SELECTOR))
  );
}

test.describe('copy-button Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('Each copy button is a <button> with type="button"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const buttons = getCopyButtonsFromDocs(docs);
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of buttons) {
      expect(btn.tagName.toLowerCase()).toBe('button');
      expect(btn.getAttribute('type')).toBe('button');
    }
  });

  test('Each copy button has a command attribute whose value starts with -- and a commandfor attribute that references the id of an existing element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const buttons = getCopyButtonsFromDocs(docs);
    expect(buttons.length).toBeGreaterThan(0);

    for (const docEntry of docs) {
      const docButtons = Array.from(
        docEntry.document.querySelectorAll(COPY_BTN_SELECTOR)
      ) as any[];
      for (const btn of docButtons) {
        const command = btn.getAttribute('command');
        const commandfor = btn.getAttribute('commandfor');
        expect(command).toBeTruthy();
        expect(command.startsWith('--')).toBe(true);
        expect(commandfor).toBeTruthy();
        const target = docEntry.document.getElementById(commandfor);
        expect(target).toBeTruthy();
      }
    }
  });

  test('The live region is not a descendant of any copy button', () => {
    const docs = getHtmlDocuments(targetFiles);
    const buttons = getCopyButtonsFromDocs(docs);
    expect(buttons.length).toBeGreaterThan(0);

    const liveRegions = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll(LIVE_REGION_SELECTOR))
    ) as any[];
    expect(liveRegions.length).toBeGreaterThan(0);

    for (const region of liveRegions) {
      const parentButton = region.closest(COPY_BTN_SELECTOR);
      expect(parentButton).toBeNull();
    }
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Clicking a copy button writes the rendered text content of its commandfor target, preserving rendered line breaks, to the clipboard (navigator.clipboard.writeText)', async ({
      page,
    }) => {
      const count = await page.locator(COPY_BTN_SELECTOR).count();
      expect(count).toBeGreaterThan(0);

      await page.evaluate(() => {
        (window as any).__copiedTexts = [];
        const writeMock = async (text: string) => {
          (window as any).__copiedTexts.push(text);
        };
        try {
          if (navigator.clipboard) {
            Object.defineProperty(navigator.clipboard, 'writeText', {
              value: writeMock,
              configurable: true,
              writable: true,
            });
          } else {
            Object.defineProperty(navigator, 'clipboard', {
              value: { writeText: writeMock },
              configurable: true,
            });
          }
        } catch {
          Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeMock },
            configurable: true,
          });
        }
      });

      const expectedMultiline = await page.evaluate((sel) => {
        const btn = document.querySelector(sel) as HTMLElement;
        const targetId = btn.getAttribute('commandfor')!;
        const target = document.getElementById(targetId)!;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          target.value = 'Line 1\nLine 2';
          return target.value;
        }
        target.innerHTML = 'Line 1<br>Line 2';
        return target.innerText.trim();
      }, COPY_BTN_SELECTOR);

      await page.locator(COPY_BTN_SELECTOR).first().click({ force: true });

      await expect
        .poll(async () => {
          return await page.evaluate(() => (window as any).__copiedTexts);
        })
        .toContain(expectedMultiline);
    });

    test('Every copy button has a non-empty accessible name that is exposed in the accessibility tree even when the button shows only an icon', async ({
      page,
    }) => {
      const buttons = page.locator(COPY_BTN_SELECTOR);
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        await expect(btn).toHaveAccessibleName(/\S+/);
        const snapshot = await btn.ariaSnapshot();
        expect(snapshot).toMatch(/button\s+"[^"]+"/);
      }
    });

    test('A live region (role="status" or aria-live) exists on the page, starts empty, and becomes non-empty after a successful copy', async ({
      page,
    }) => {
      const count = await page.locator(COPY_BTN_SELECTOR).count();
      expect(count).toBeGreaterThan(0);

      const liveRegions = page.locator(LIVE_REGION_SELECTOR);
      const regionCount = await liveRegions.count();
      expect(regionCount).toBeGreaterThan(0);

      for (let i = 0; i < regionCount; i++) {
        const text = await liveRegions.nth(i).textContent();
        expect((text ?? '').trim()).toBe('');
      }

      await page.evaluate(() => {
        const writeMock = async () => {};
        try {
          Object.defineProperty(navigator.clipboard, 'writeText', {
            value: writeMock,
            configurable: true,
            writable: true,
          });
        } catch {
          Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeMock },
            configurable: true,
          });
        }
      });

      await page.locator(COPY_BTN_SELECTOR).first().click({ force: true });

      await expect
        .poll(async () => {
          const texts = await liveRegions.allTextContents();
          return texts.some((t) => t.trim().length > 0);
        })
        .toBe(true);
    });

    test('When the clipboard write fails, the live region reports a failure message', async ({
      page,
    }) => {
      const count = await page.locator(COPY_BTN_SELECTOR).count();
      expect(count).toBeGreaterThan(0);

      const liveRegions = page.locator(LIVE_REGION_SELECTOR);
      expect(await liveRegions.count()).toBeGreaterThan(0);

      await page.evaluate(() => {
        const failMock = async () => {
          throw new Error('Clipboard write rejected');
        };
        try {
          Object.defineProperty(navigator.clipboard, 'writeText', {
            value: failMock,
            configurable: true,
            writable: true,
          });
        } catch {
          Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: failMock },
            configurable: true,
          });
        }
        document.execCommand = () => false;
      });

      await page.locator(COPY_BTN_SELECTOR).first().click({ force: true });

      await expect
        .poll(async () => {
          const texts = await liveRegions.allTextContents();
          return texts.map((t) => t.trim()).find((t) => t.length > 0) ?? '';
        })
        .toMatch(/fail|error|unable|could not|denied/i);
    });

    test('When the clipboard write fails, the clicked button does not gain its copied state', async ({
      page,
    }) => {
      const buttons = page.locator(COPY_BTN_SELECTOR);
      expect(await buttons.count()).toBeGreaterThan(0);

      const liveRegions = page.locator(LIVE_REGION_SELECTOR);
      expect(await liveRegions.count()).toBeGreaterThan(0);

      await page.evaluate(() => {
        const failMock = async () => {
          throw new Error('Clipboard write rejected');
        };
        try {
          Object.defineProperty(navigator.clipboard, 'writeText', {
            value: failMock,
            configurable: true,
            writable: true,
          });
        } catch {
          Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: failMock },
            configurable: true,
          });
        }
        document.execCommand = () => false;
      });

      const firstBtn = buttons.first();
      await firstBtn.click({ force: true });

      await expect
        .poll(async () => {
          const texts = await liveRegions.allTextContents();
          return texts.some((t) => t.trim().length > 0);
        })
        .toBe(true);

      const hasCopiedState = await firstBtn.evaluate((el) => {
        return (
          el.hasAttribute('data-copied') ||
          el.classList.contains('copied') ||
          el.classList.contains('is-copied') ||
          el.getAttribute('data-state') === 'copied'
        );
      });
      expect(hasCopiedState).toBe(false);
    });

    test('Each visible copy button is at least 24 by 24 CSS pixels', async ({ page }) => {
      const buttons = page.locator(COPY_BTN_SELECTOR);
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        const card = btn.locator('xpath=ancestor::*[contains(@class, "card")][1]');
        if ((await card.count()) > 0) {
          await card.hover();
        }
        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(24);
        expect(box!.height).toBeGreaterThanOrEqual(24);
      }
    });

    test('Clicking a copy button does not disable the button while feedback is shown', async ({
      page,
    }) => {
      const buttons = page.locator(COPY_BTN_SELECTOR);
      expect(await buttons.count()).toBeGreaterThan(0);

      const liveRegions = page.locator(LIVE_REGION_SELECTOR);
      expect(await liveRegions.count()).toBeGreaterThan(0);

      await page.evaluate(() => {
        const writeMock = async () => {};
        try {
          Object.defineProperty(navigator.clipboard, 'writeText', {
            value: writeMock,
            configurable: true,
            writable: true,
          });
        } catch {
          Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeMock },
            configurable: true,
          });
        }
      });

      const firstBtn = buttons.first();
      await firstBtn.click({ force: true });

      await expect
        .poll(async () => {
          const texts = await liveRegions.allTextContents();
          return texts.some((t) => t.trim().length > 0);
        })
        .toBe(true);

      await expect(firstBtn).toBeEnabled();
      const ariaDisabled = await firstBtn.getAttribute('aria-disabled');
      expect(ariaDisabled).not.toBe('true');
    });

    test('After a successful copy the clicked button gains a visual copied state (such as a data-copied attribute or class) that is removed again after a timeout', async ({
      page,
    }) => {
      const buttons = page.locator(COPY_BTN_SELECTOR);
      expect(await buttons.count()).toBeGreaterThan(0);

      await page.evaluate(() => {
        const origSetTimeout = window.setTimeout;
        window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: any[]) => {
          const adjustedMs = typeof ms === 'number' && ms >= 500 ? 400 : ms;
          return origSetTimeout(fn, adjustedMs, ...args);
        }) as typeof window.setTimeout;

        const writeMock = async () => {};
        try {
          Object.defineProperty(navigator.clipboard, 'writeText', {
            value: writeMock,
            configurable: true,
            writable: true,
          });
        } catch {
          Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeMock },
            configurable: true,
          });
        }
      });

      const firstBtn = buttons.first();
      const getCopiedState = () =>
        firstBtn.evaluate((el) => {
          return (
            el.hasAttribute('data-copied') ||
            el.classList.contains('copied') ||
            el.classList.contains('is-copied') ||
            el.getAttribute('data-state') === 'copied'
          );
        });

      expect(await getCopiedState()).toBe(false);

      await firstBtn.click({ force: true });

      await expect.poll(getCopiedState).toBe(true);
      await expect.poll(getCopiedState, { timeout: 5000 }).toBe(false);
    });

    test('When invoker-commands is unsupported, clicking a copy button still copies the text of its commandfor target to the clipboard', async ({
      page,
      TARGET_URL,
    }) => {
      skipUnless({ unsupported: 'invoker-commands' });

      await page.addInitScript(() => {
        delete (window as any).CommandEvent;
        if ('command' in HTMLButtonElement.prototype) {
          delete (HTMLButtonElement.prototype as any).command;
        }
        if ('commandForElement' in HTMLButtonElement.prototype) {
          delete (HTMLButtonElement.prototype as any).commandForElement;
        }
        const origAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (
          type: string,
          listener: any,
          options?: any
        ) {
          if (type === 'command') return;
          return origAddEventListener.call(this, type, listener, options);
        };
      });

      await page.goto(TARGET_URL);

      const buttons = page.locator(COPY_BTN_SELECTOR);
      expect(await buttons.count()).toBeGreaterThan(0);

      await page.evaluate(() => {
        (window as any).__fallbackCopied = [];
        const writeMock = async (text: string) => {
          (window as any).__fallbackCopied.push(text);
        };
        try {
          Object.defineProperty(navigator.clipboard, 'writeText', {
            value: writeMock,
            configurable: true,
            writable: true,
          });
        } catch {
          Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeMock },
            configurable: true,
          });
        }
      });

      const expectedText = await page.evaluate((sel) => {
        const btn = document.querySelector(sel) as HTMLElement;
        const targetId = btn.getAttribute('commandfor')!;
        const target = document.getElementById(targetId)!;
        return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? target.value
          : target.innerText.trim();
      }, COPY_BTN_SELECTOR);

      expect(expectedText.length).toBeGreaterThan(0);

      await buttons.first().click({ force: true });

      await expect
        .poll(async () => {
          return await page.evaluate(() => (window as any).__fallbackCopied);
        })
        .toContain(expectedText);
    });
  });
});
