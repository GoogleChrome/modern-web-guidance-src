import { test, expect } from '@playwright/test';
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

// A global helper to deduplicate all MutationObserver boilerplate
async function waitForAnimationSpy(page: any, triggerAction: () => Promise<void>) {
  await page.evaluate(() => {
    (window as any)._animationObserved = false;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target;
        if (target instanceof Element && target.getAnimations && target.getAnimations().length > 0) {
          (window as any)._animationObserved = true;
        }
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element && node.getAnimations && node.getAnimations().length > 0) {
            (window as any)._animationObserved = true;
          }
        }
      }
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  });

  await triggerAction();

  await expect.poll(async () => {
    return await page.evaluate(() => (window as any)._animationObserved);
  }, { timeout: 2000 }).toBe(true);
}

test.describe(`animate-element-entry-exit Expectations: ${demoName}`, () => {

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
    await page.waitForTimeout(500);
  });

  test(`uses @starting-style to define starting property values for entry animation`, async ({ page }) => {
    const hasStartingStyle = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.constructor.name === 'CSSStartingStyleRule') return true;
            if (rule.cssText && rule.cssText.includes('@starting-style')) return true;
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return false;
    });
    expect(hasStartingStyle).toBe(true);
  });

  test(`includes transition-behavior: allow-discrete or allow-discrete keyword for display`, async ({ page }) => {
    const el = page.locator('.card').first();
    const transitionBehavior = await el.evaluate(e => window.getComputedStyle(e).transitionBehavior);
    expect(transitionBehavior).toMatch(/allow-discrete/);
  });

  test(`includes display property in transition list`, async ({ page }) => {
    const el = page.locator('.card').first();
    const transitionProperty = await el.evaluate(e => window.getComputedStyle(e).transitionProperty);
    expect(transitionProperty).toContain('display');
  });

  test(`smoothly transitions properties when added to DOM`, async ({ page }) => {
    await waitForAnimationSpy(page, async () => {
      await page.click('#addBtn', { timeout: 2000 });
    });
  });

  test(`smoothly transitions to hidden values before being hidden from layout`, async ({ page }) => {
    const toggleCard = page.locator('#toggleCard');
    await expect(toggleCard).toBeVisible({ timeout: 2000 });

    await waitForAnimationSpy(page, async () => {
      await page.click('#toggleBtn', { timeout: 2000 });
    });
  });

  test(`smoothly transitions properties from @starting-style values when display changes from none to visible`, async ({ page }) => {
    const toggleCard = page.locator('#toggleCard');
    if (await toggleCard.isVisible({ timeout: 2000 })) {
      await page.click('#toggleBtn', { timeout: 2000 });
      await expect(toggleCard).toBeHidden({ timeout: 2000 });
    }

    await waitForAnimationSpy(page, async () => {
      await page.click('#toggleBtn', { timeout: 2000 });
    });
  });

  test(`waits for exit transition to complete before removing element from DOM`, async ({ page }) => {
    await page.evaluate(() => {
      (window as any)._removeSpyCalled = false;
      (window as any)._removeWasDelayed = false;
      (window as any)._clickTimestamp = 0;

      document.addEventListener('click', (e) => {
        if (e.target instanceof Element && e.target.id === 'removeBtn') {
          (window as any)._clickTimestamp = performance.now();
        }
      }, { capture: true });

      const originalRemove = Element.prototype.remove;
      Element.prototype.remove = function () {
        (window as any)._removeSpyCalled = true;
        if ((window as any)._clickTimestamp > 0 && (performance.now() - (window as any)._clickTimestamp) > 100) {
          (window as any)._removeWasDelayed = true;
        }
        originalRemove.call(this);
      };
    });

    await page.click('#removeBtn', { timeout: 2000 });

    await expect.poll(async () => {
      return await page.evaluate(() => (window as any)._removeSpyCalled && (window as any)._removeWasDelayed);
    }, { timeout: 2000 }).toBe(true);
  });

  test(`transition durations for entry and exit are reasonable (0.3s to 1s)`, async ({ page }) => {
    const el = page.locator('.card').first();
    const transitionDuration = await el.evaluate(e => window.getComputedStyle(e).transitionDuration);
    const durations = transitionDuration.split(',').map(s => parseFloat(s));

    const hasReasonableDuration = durations.some(d => d >= 0.3 && d <= 1.0);
    expect(hasReasonableDuration).toBe(true);
  });

});
