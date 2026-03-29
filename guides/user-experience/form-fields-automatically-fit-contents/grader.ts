import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`field-sizing Expectations: ${demoName}`, () => {
  const getAppliedStyles = async (page: Page, selector: string) => {
    return page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (!el) throw new Error(`Element ${sel} not found`);
      const styles: Record<string, string> = {};
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                styles[prop] = rule.style.getPropertyValue(prop);
              }
            }
          }
        } catch (e) {
          // Ignore cross-origin errors
        }
      }
      for (let i = 0; i < el.style.length; i++) {
        const prop = el.style[i];
        styles[prop] = el.style.getPropertyValue(prop);
      }
      return styles;
    }, selector);
  };

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.substring(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  // 1. The input element has `field-sizing: content` applied.
  test(`The input element has field-sizing: content applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'input[type="text"]');
    expect(styles['field-sizing']).toBe('content');
  });

  // 2. The input element has an explicit `width` of `auto` or `fit-content` applied.
  test(`The input element has an explicit width of auto or fit-content applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'input[type="text"]');
    expect(['auto', 'fit-content']).toContain(styles['width']);
  });

  // 3. The input element has `align-self: start`, `justify-self: start`, or `align-self: flex-start` applied to override implicit stretching.
  test(`The input element has align-self: start, justify-self: start, or align-self: flex-start applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'input[type="text"]');
    const isOverridden = ['start', 'flex-start'].includes(styles['align-self']) || ['start', 'flex-start'].includes(styles['justify-self']);
    expect(isOverridden).toBe(true);
  });

  // 4. The input element has a minimum inline size (`min-inline-size` or `min-width`) applied.
  test(`The input element has a minimum inline size applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'input[type="text"]');
    const hasMinSize = !!styles['min-inline-size'] || !!styles['min-width'];
    expect(hasMinSize).toBe(true);
  });

  // 5. The input element has a maximum inline size (`max-inline-size` or `max-width`) applied.
  test(`The input element has a maximum inline size applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'input[type="text"]');
    const hasMaxSize = !!styles['max-inline-size'] || !!styles['max-width'];
    expect(hasMaxSize).toBe(true);
  });

  // 6. The textarea element has `field-sizing: content` applied.
  test(`The textarea element has field-sizing: content applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'textarea');
    expect(styles['field-sizing']).toBe('content');
  });

  // 7. The textarea element has an explicit `height` of `auto` or `fit-content` applied.
  test(`The textarea element has an explicit height of auto or fit-content applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'textarea');
    expect(['auto', 'fit-content']).toContain(styles['height']);
  });

  // 8. The textarea element has an explicit inline size (`width` or `inline-size`) applied.
  test(`The textarea element has an explicit inline size applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'textarea');
    const hasInlineSize = !!styles['width'] || !!styles['inline-size'];
    expect(hasInlineSize).toBe(true);
  });

  // 9. The textarea element has a minimum block size (`min-block-size` or `min-height`) applied.
  test(`The textarea element has a minimum block size applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'textarea');
    const hasMinBlockSize = !!styles['min-block-size'] || !!styles['min-height'];
    expect(hasMinBlockSize).toBe(true);
  });

  // 10. The textarea element has a maximum block size (`max-block-size` or `max-height`) applied.
  test(`The textarea element has a maximum block size applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'textarea');
    const hasMaxBlockSize = !!styles['max-block-size'] || !!styles['max-height'];
    expect(hasMaxBlockSize).toBe(true);
  });

  // 11. The select element has `field-sizing: content` applied.
  test(`The select element has field-sizing: content applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'select');
    expect(styles['field-sizing']).toBe('content');
  });

  // 12. The select element has an explicit `width` of `auto` or `fit-content` applied.
  test(`The select element has an explicit width of auto or fit-content applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'select');
    expect(['auto', 'fit-content']).toContain(styles['width']);
  });

  // 13. The select element has `align-self: start`, `justify-self: start`, or `align-self: flex-start` applied to override implicit stretching.
  test(`The select element has align-self or justify-self applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'select');
    const isOverridden = ['start', 'flex-start'].includes(styles['align-self']) || ['start', 'flex-start'].includes(styles['justify-self']);
    expect(isOverridden).toBe(true);
  });

  // 14. The select element has a maximum inline size (`max-inline-size` or `max-width`) applied.
  test(`The select element has a maximum inline size applied`, async ({ page }) => {
    const styles = await getAppliedStyles(page, 'select');
    const hasMaxSize = !!styles['max-inline-size'] || !!styles['max-width'];
    expect(hasMaxSize).toBe(true);
  });
});
