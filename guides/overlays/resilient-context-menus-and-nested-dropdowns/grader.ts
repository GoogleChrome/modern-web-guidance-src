import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import * as path from 'path';

const targetFilePath = path.resolve(process.env.TARGET_FILE || './demo.html');
const targetFileUrl = pathToFileURL(targetFilePath).href;

test.describe('Resilient Context Menus and Nested Dropdowns Grader', () => {

  test('The dropdown menu uses the Popover API', async ({ page }) => {
    await page.goto(targetFileUrl);
    const panel = page.locator('#action-panel');
    await expect(panel).toHaveAttribute('popover');
  });

  test('The trigger has popovertarget matching the dropdown menu ID', async ({ page }) => {
    await page.goto(targetFileUrl);
    const trigger = page.locator('#trigger-btn');
    await expect(trigger).toHaveAttribute('popovertarget', 'action-panel');
  });

  test('The stylesheet uses anchor() on inset properties to position the target relative to the anchor', async ({ page }) => {
    await page.goto(targetFileUrl);
    const usesAnchor = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.includes('anchor(')) {
              return true;
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return false;
    });
    expect(usesAnchor).toBe(true);
  });

  test('The stylesheet defines position-try-fallbacks for overflow handling', async ({ page }) => {
    await page.goto(targetFileUrl);
    const hasPositionTry = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.includes('position-try-fallbacks')) {
              return true;
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return false;
    });
    expect(hasPositionTry).toBe(true);
  });

  test('The stylesheet uses flip-block, flip-inline, or equivalent custom @position-try rules for edge collisions', async ({ page }) => {
    await page.goto(targetFileUrl);
    const hasEdgeHandling = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            const text = rule.cssText;
            if (text.includes('flip-block') || text.includes('flip-inline') || text.includes('@position-try')) {
              return true;
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return false;
    });
    expect(hasEdgeHandling).toBe(true);
  });

  test('The popover polyfill is conditionally loaded based on popover support', async ({ page }) => {
    await page.goto(targetFileUrl);
    const hasPopoverPolyfill = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script => {
        const code = script.textContent || '';
        const checksPopover = code.includes('popover') && (code.includes('hasOwnProperty') || code.includes('in HTMLElement') || code.includes('in document'));
        const loadsPolyfill = code.includes('popover-polyfill');
        return checksPopover && loadsPolyfill;
      });
    });
    expect(hasPopoverPolyfill).toBe(true);
  });

  test('The anchor positioning polyfill is conditionally loaded based on support', async ({ page }) => {
    await page.goto(targetFileUrl);
    const hasAnchorPolyfill = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script => {
        const code = script.textContent || '';
        const checksAnchor = code.includes('anchorName') || code.includes('positionAnchor');
        const loadsPolyfill = code.includes('css-anchor-positioning');
        return checksAnchor && loadsPolyfill;
      });
    });
    expect(hasAnchorPolyfill).toBe(true);
  });

  test('The overlay container does not have role="menu"', async ({ page }) => {
    await page.goto(targetFileUrl);
    const panel = page.locator('#action-panel');
    await expect(panel).not.toHaveAttribute('role', 'menu');
  });

  test('The trigger does not have aria-haspopup', async ({ page }) => {
    await page.goto(targetFileUrl);
    const trigger = page.locator('#trigger-btn');
    await expect(trigger).not.toHaveAttribute('aria-haspopup');
  });

  test('The items in the overlay do not have role="menuitem"', async ({ page }) => {
    await page.goto(targetFileUrl);
    const menuitems = page.locator('#action-panel [role="menuitem"]');
    await expect(menuitems).toHaveCount(0);
  });

});
