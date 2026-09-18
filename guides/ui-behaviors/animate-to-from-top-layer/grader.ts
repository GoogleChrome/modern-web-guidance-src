/// <reference types="node" />
import { test, expect } from '@playwright/test';
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

test.describe(`Top Layer Animation Expectations: ${demoName}`, () => {

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

  test('The <dialog> element must include "overlay" and "display" in its transition properties with "allow-discrete"', async ({ page }) => {
    const dialog = page.locator('dialog');
    const props = await dialog.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        transitionProperty: style.transitionProperty,
        // @ts-ignore - transitionBehavior is a newer property
        transitionBehavior: style.transitionBehavior || (style as any).webkitTransitionBehavior
      };
    });

    const transitionProps = props.transitionProperty.split(',').map(p => p.trim());
    expect(transitionProps).toContain('overlay');
    expect(transitionProps).toContain('display');
    expect(props.transitionBehavior).toContain('allow-discrete');
  });

  test('The [popover] element must include "overlay" and "display" in its transition properties with "allow-discrete"', async ({ page }) => {
    const popover = page.locator('[popover]');
    const props = await popover.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        transitionProperty: style.transitionProperty,
        // @ts-ignore
        transitionBehavior: style.transitionBehavior || (style as any).webkitTransitionBehavior
      };
    });

    const transitionProps = props.transitionProperty.split(',').map(p => p.trim());
    expect(transitionProps).toContain('overlay');
    expect(transitionProps).toContain('display');
    expect(props.transitionBehavior).toContain('allow-discrete');
  });

  test('The <dialog> element must use the @starting-style at-rule', async ({ page }) => {
    const hasStartingStyle = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            // Check if the rule is @starting-style (type 17) or if its text contains it
            if (rule.type === 17 || rule.constructor.name === 'CSSStartingStyleRule' || rule.cssText.includes('@starting-style')) {
              // Ensure it's applied to a dialog
              if (rule.cssText.includes('dialog')) return true;
              // Also check nested rules if it's a starting-style rule
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
    expect(hasStartingStyle).toBe(true);
  });

  test('The [popover] element must use the @starting-style at-rule', async ({ page }) => {
    const hasStartingStyle = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
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
    expect(hasStartingStyle).toBe(true);
  });

  test('The <dialog> element must smoothly transition when opened', async ({ page }) => {
    const openBtn = page.locator('#open-dialog-btn, #openDialog').first();
    const dialog = page.locator('dialog').first();

    // Ensure it's closed
    await expect(dialog).not.toBeVisible();

    // Open it
    await openBtn.click();

    // Immediately check if it's transitioning (opacity should be less than 1 if it started from 0 or @starting-style)
    const opacity = await dialog.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).opacity);
    });

    expect(opacity).toBeLessThan(1);

    // Wait for it to be fully open
    await expect(dialog).toHaveCSS('opacity', '1');
  });

  test('The <dialog> element must smoothly transition when closed', async ({ page }) => {
    const openBtn = page.locator('#open-dialog-btn, #openDialog').first();
    const closeBtn = page.locator('#close-dialog-btn, #closeDialog').first();
    const dialog = page.locator('dialog').first();

    await openBtn.click();
    await expect(dialog).toHaveCSS('opacity', '1');

    // Close it
    await closeBtn.click();

    // Because of allow-discrete and overlay, it should still be in the DOM and visible during transition
    await expect.poll(async () => {
      return await dialog.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && parseFloat(style.opacity) > 0 && parseFloat(style.opacity) < 1;
      });
    }, { timeout: 1000 }).toBe(true);

    // Eventually it should be gone
    await expect(dialog).not.toBeVisible();
  });

  test('The [popover] element must smoothly transition when opened', async ({ page }) => {
    const popoverBtn = page.locator('#foobar, [popovertarget]').first();
    const popover = page.locator('[popover]').first();

    await expect(popover).not.toBeVisible();
    await popoverBtn.click();

    const opacity = await popover.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).opacity);
    });

    expect(opacity).toBeLessThan(1);
    await expect(popover).toHaveCSS('opacity', '1');
  });

  test('The <dialog> ::backdrop must be animated', async ({ page }) => {
    const openBtn = page.locator('#open-dialog-btn, #openDialog').first();
    const dialog = page.locator('dialog').first();

    await openBtn.click();

    // Check backdrop transition properties
    const backdropProps = await dialog.evaluate((el) => {
      const style = window.getComputedStyle(el, '::backdrop');
      return {
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        // @ts-ignore
        transitionBehavior: style.transitionBehavior || (style as any).webkitTransitionBehavior
      };
    });

    expect(backdropProps.transitionProperty).toMatch(/background-color|opacity|all/);
    expect(parseFloat(backdropProps.transitionDuration)).toBeGreaterThan(0);
    expect(backdropProps.transitionBehavior).toContain('allow-discrete');
  });

  test('The implementation must respect prefers-reduced-motion', async ({ page }) => {
    const dialog = page.locator('dialog').first();
    const openBtn = page.locator('#open-dialog-btn, #openDialog').first();

    // Get normal duration
    await openBtn.click();
    const normalDuration = await dialog.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).transitionDuration);
    });

    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const reducedDuration = await dialog.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).transitionDuration);
    });

    await dialog.evaluate((el) => {
      return window.getComputedStyle(el).transform;
    });

    // In reduced motion, duration should be significantly shorter than normal
    expect(reducedDuration).toBeLessThan(normalDuration);
    expect(reducedDuration).toBeLessThanOrEqual(0.11);
  });
});
