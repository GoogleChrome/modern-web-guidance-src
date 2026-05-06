import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe(`Swipeable Drawer Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    const TARGET_URL = 'http://127.0.0.1/';
    await page.route('http://127.0.0.1/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.slice(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(TARGET_URL);
  });

  async function getElements(page: Page) {
    let trigger = page.locator('button[aria-expanded], button[aria-controls], button[aria-haspopup]').first();
    if (await trigger.count() === 0) {
      const buttons = page.locator('button');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        if (await btn.isVisible()) {
          const id = await btn.getAttribute('id') || '';
          const ariaLabel = await btn.getAttribute('aria-label') || '';
          if (!id.includes('close') && !ariaLabel.toLowerCase().includes('close')) {
            trigger = btn;
            break;
          }
        }
      }
    }
    if (await trigger.count() === 0) {
      trigger = page.locator('button').first();
    }

    const controls = await trigger.getAttribute('aria-controls');
    let drawer;
    if (controls) {
      drawer = page.locator(`#${controls}`);
    } else {
      drawer = page.locator('[popover]').first();
      if (await drawer.count() === 0) {
        drawer = page.locator('div').filter({ has: page.locator('ul') }).first();
      }
    }
    return { trigger, drawer };
  }

  async function waitForOpen(page: Page, trigger: any) {
    try {
      await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
    } catch (e: any) {
      if (e && e.message && e.message.includes('timeout')) {
        await page.waitForTimeout(500);
      } else {
        throw e;
      }
    }
  }

  async function clickTrigger(trigger: any) {
    // We use evaluate to call click() directly on the DOM element.
    // This avoids Playwright waiting for element actionability (which times out
    // if a broken drawer covers the button initially, like in negative-demo.html).
    await trigger.evaluate((btn: HTMLElement) => btn.click());
  }

  test('The drawer is not visible when the page first loads', async ({ page }) => {
    const { drawer } = await getElements(page);
    await expect(drawer).not.toBeVisible();
  });

  test('The menu trigger button has aria-expanded="false" when the drawer is closed', async ({ page }) => {
    const { trigger } = await getElements(page);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('Clicking the menu trigger button makes the drawer visible', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await expect(drawer).not.toBeVisible(); // Must be hidden initially for this test
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
  });

  test('When the drawer is open, the menu trigger button\'s aria-expanded attribute is true', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('The drawer element uses the popover API with popover="manual"', async ({ page }) => {
    const { drawer } = await getElements(page);
    await expect(drawer).toHaveAttribute('popover', 'manual');
  });

  test('When the drawer is open, a dimmed backdrop (the ::backdrop pseudo-element) is visible behind it that covers the rest of the page', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);

    const isBackdropVisible = await drawer.evaluate((el) => {
      const style = window.getComputedStyle(el, '::backdrop');
      const opacity = parseFloat(style.opacity);
      return style.display !== 'none' && !isNaN(opacity) && opacity > 0 && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
    });
    expect(isBackdropVisible).toBe(true);
  });

  test('The drawer\'s navigation sheet does not span the full width of the viewport when open, leaving a portion of the dimmed backdrop visible alongside it', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);

    const isNarrower = await drawer.evaluate((el) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const els = Array.from(el.querySelectorAll('*'));
      for (const e of els) {
        const rect = e.getBoundingClientRect();
        const style = window.getComputedStyle(e);
        if (rect.width > 0 && rect.width < vw && rect.height >= vh * 0.5 && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          return true;
        }
      }
      return false;
    });
    expect(isNarrower).toBe(true);
  });

  test('Clicking the dimmed backdrop area outside the navigation sheet closes the drawer', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);
    
    const sheetRect = await drawer.evaluate((el) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const els = Array.from(el.querySelectorAll('*'));
      for (const e of els) {
        const rect = e.getBoundingClientRect();
        const style = window.getComputedStyle(e);
        if (rect.width > 0 && rect.width < vw && rect.height >= vh * 0.5 && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
      }
      return null;
    });
    
    if (sheetRect) {
      let clickX = 10;
      if (sheetRect.x === 0) {
        clickX = sheetRect.width + 10;
      }
      await page.mouse.click(clickX, sheetRect.y + 10);
    } else {
      const vw = await page.evaluate(() => window.innerWidth);
      await page.mouse.click(vw - 10, 10);
    }
    await expect(drawer).not.toBeVisible();
  });

  test('Pressing the Escape key while the drawer is open closes the drawer', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('The main page content has the inert attribute applied while the drawer is open', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);

    const main = page.locator('main');
    const hasInertAncestor = (el: any) => {
      let current = el;
      while (current) {
        if (current.inert || current.hasAttribute('inert')) return true;
        current = current.parentElement;
      }
      return false;
    };

    if (await main.count() > 0) {
      const isInert = await main.evaluate(hasInertAncestor);
      expect(isInert).toBe(true);
    } else {
      const parent = trigger.locator('..');
      const isInert = await parent.evaluate(hasInertAncestor);
      expect(isInert).toBe(true);
    }
  });

  test('The main page content no longer has the inert attribute after the drawer is closed', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    
    const main = page.locator('main');
    const hasInertAncestor = (el: any) => {
      let current = el;
      while (current) {
        if (current.inert || current.hasAttribute('inert')) return true;
        current = current.parentElement;
      }
      return false;
    };

    if (await main.count() > 0) {
      const isInert = await main.evaluate(hasInertAncestor);
      expect(isInert).toBe(false);
    } else {
      const parent = trigger.locator('..');
      const isInert = await parent.evaluate(hasInertAncestor);
      expect(isInert).toBe(false);
    }
  });

  test('Keyboard focus is moved inside the drawer after it opens', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);
    
    const isFocusInside = await drawer.evaluate((el) => {
      const active = document.activeElement;
      return el === active || el.contains(active);
    });
    expect(isFocusInside).toBe(true);
  });

  test('After the drawer is closed, the menu trigger button\'s aria-expanded attribute returns to false', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('The drawer\'s horizontal scroll container uses CSS scroll snap with scroll-snap-type: x mandatory', async ({ page }) => {
    const { drawer } = await getElements(page);
    
    const hasScrollSnap = await drawer.evaluate((el) => {
      const els = [el, ...Array.from(el.querySelectorAll('*'))];
      for (const e of els) {
        const style = window.getComputedStyle(e);
        if (style.scrollSnapType.includes('x') && style.scrollSnapType.includes('mandatory')) {
          return true;
        }
      }
      return false;
    });
    expect(hasScrollSnap).toBe(true);
  });

  test('The drawer\'s horizontal scroll container uses scroll-behavior: smooth only when the user has not requested reduced motion (e.g., via @media (prefers-reduced-motion: no-preference))', async ({ page }) => {
    const { drawer } = await getElements(page);
    
    // First, check that with no preference, it's smooth
    await page.emulateMedia({ reducedMotion: null });
    const isSmoothNoPreference = await drawer.evaluate((el) => {
      const els = [el, ...Array.from(el.querySelectorAll('*'))];
      for (const e of els) {
        const style = window.getComputedStyle(e);
        if (style.scrollBehavior === 'smooth') {
          return true;
        }
      }
      return false;
    });
    expect(isSmoothNoPreference).toBe(true);

    // Second, check that with reduce, it's not smooth
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const isSmoothReduce = await drawer.evaluate((el) => {
      const els = [el, ...Array.from(el.querySelectorAll('*'))];
      for (const e of els) {
        const style = window.getComputedStyle(e);
        if (style.scrollBehavior === 'smooth') {
          return true;
        }
      }
      return false;
    });
    expect(isSmoothReduce).toBe(false);
  });

  test('Horizontally scrolling the drawer\'s scroll container all the way to its end position closes the drawer', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);
    
    const scrolled = await drawer.evaluate((el) => {
      const els = [el, ...Array.from(el.querySelectorAll('*'))];
      for (const e of els) {
        if (e.scrollWidth > e.clientWidth) {
          e.scrollLeft = e.scrollWidth;
          return true;
        }
      }
      return false;
    });
    
    expect(scrolled).toBe(true);
    await expect(drawer).not.toBeVisible();
  });

  test('The drawer\'s backdrop opacity decreases as the drawer\'s scroll container is scrolled toward the closed position', async ({ page }) => {
    const { trigger, drawer } = await getElements(page);
    await clickTrigger(trigger);
    await expect(drawer).toBeVisible();
    await waitForOpen(page, trigger);
    
    const initialOpacity = await drawer.evaluate((el) => {
      const style = window.getComputedStyle(el, '::backdrop');
      return parseFloat(style.opacity);
    });
    
    expect(isNaN(initialOpacity)).toBe(false);
    expect(initialOpacity).toBeGreaterThan(0);
    
    const scrolledHalf = await drawer.evaluate(async (el) => {
      const e = Array.from(el.querySelectorAll('*')).find(x => x.scrollWidth > x.clientWidth) as HTMLElement;
      if (!e) return false;
      
      e.style.scrollSnapType = 'none';
      e.scrollLeft = (e.scrollWidth - e.clientWidth) / 2;
      e.dispatchEvent(new Event('scroll'));
      return true;
    });
    
    expect(scrolledHalf).toBe(true);
    
    await page.waitForTimeout(200);
    
    const halfOpacity = await drawer.evaluate((el) => {
      const style = window.getComputedStyle(el, '::backdrop');
      return parseFloat(style.opacity);
    });
    
    expect(isNaN(halfOpacity)).toBe(false);
    expect(halfOpacity).toBeLessThan(initialOpacity);
  });

});
