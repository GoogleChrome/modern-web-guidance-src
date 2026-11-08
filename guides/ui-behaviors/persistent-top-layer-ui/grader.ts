import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not set');
}
const TARGET_FILE_URL = targetFile.startsWith('http') ? targetFile : `file://${targetFile}`;

async function clickMoveButton(page: any) {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"]'));
    const btn = buttons.find(b => {
      if (/move|relocate|reparent|dock/i.test(b.textContent || b.id || b.className)) return true;
      for (const attr of b.getAttributeNames()) {
        if (/move|relocate|reparent|dock/i.test(attr) || /move|relocate|reparent|dock/i.test(b.getAttribute(attr) || '')) {
          return true;
        }
      }
      const parentFieldset = b.closest('fieldset, div, section');
      if (parentFieldset && /move|relocate|reparent|dock/i.test(parentFieldset.getAttribute('aria-label') || parentFieldset.querySelector('legend, h2, h3, h4')?.textContent || '')) return true;
      return false;
    });
    if (!btn) throw new Error('Could not find move button');
    (btn as HTMLElement).click();
  });
}

test('The document contains a top-layer element that remains open after being moved', async ({ page }) => {
  await page.goto(TARGET_FILE_URL);
  
  // Locate a top-layer element (such as a dialog or an element with popover attribute)
  const topLayer = page.locator('dialog, [popover]').first();
  await expect(topLayer).toBeAttached();
  
  // Open the top-layer element
  const openBtn = page.locator('button:visible', { hasText: /open|feedback|show|trigger|modal/i }).first();
  await openBtn.click();
  
  // Verify it is open and mark its initial parent
  await topLayer.evaluate((el) => {
    const isOpen = el.matches(':modal') || el.matches(':popover-open') || document.fullscreenElement === el;
    if (!isOpen) throw new Error('Element was not opened');
    (el.parentElement as any).__initial_parent_marker = true;
  });

  // Move the top-layer element using the page's move trigger
  await clickMoveButton(page);

  // Verify that it remains open and has been successfully moved to a different parent
  const result = await topLayer.evaluate((el) => {
    const isOpen = el.matches(':modal') || el.matches(':popover-open') || document.fullscreenElement === el;
    const parentChanged = !(el.parentElement as any)?.__initial_parent_marker;
    return isOpen && parentChanged;
  });

  expect(result).toBe(true);
});

test('The script contains a feature detection check for moveBefore to safely handle unsupported browsers', async ({ page }) => {
  // Inject a spy to detect access/invocation of moveBefore
  await page.addInitScript(() => {
    const customWindow = window as any;
    customWindow.__moveBeforeAccessed = false;
    Object.defineProperty(Element.prototype, 'moveBefore', {
      get() {
        customWindow.__moveBeforeAccessed = true;
        return function(this: Element, node: Node, ref: Node | null) {
          this.insertBefore(node, ref);
          return node;
        };
      },
      configurable: true
    });
  });

  await page.goto(TARGET_FILE_URL);
  
  // Open the top-layer element
  const openBtn = page.locator('button:visible', { hasText: /open|feedback|show|trigger|modal/i }).first();
  await openBtn.click();

  // Move the top-layer element
  await clickMoveButton(page);
  
  // Check if accessed OR if the page scripts contain a feature detection pattern
  const isFeatureDetected = await page.evaluate(() => {
    const customWindow = window as any;
    if (customWindow.__moveBeforeAccessed) return true;
    
    // Check script source for 'moveBefore'
    const scripts = Array.from(document.querySelectorAll('script'))
      .map(s => s.textContent || '');
    const pattern = /moveBefore/i;
    return scripts.some(script => pattern.test(script));
  });
  
  expect(isFeatureDetected).toBe(true);
});

test('The script uses moveBefore to move the top-layer element to a new parent if the feature is supported', async ({ page }) => {
  await page.addInitScript(() => {
    const customWindow = window as any;
    customWindow.__moveBeforeCalled = false;
    Object.defineProperty(Element.prototype, 'moveBefore', {
      get() {
        return function(this: Element, node: Node, ref: Node | null) {
          customWindow.__moveBeforeCalled = true;
          this.insertBefore(node, ref);
          return node;
        };
      },
      configurable: true
    });
  });

  await page.goto(TARGET_FILE_URL);

  // Open the top-layer element
  const openBtn = page.locator('button:visible', { hasText: /open|feedback|show|trigger|modal/i }).first();
  await openBtn.click();

  // Move the top-layer element
  await clickMoveButton(page);

  const moveBeforeCalled = await page.evaluate(() => (window as any).__moveBeforeCalled);
  expect(moveBeforeCalled).toBe(true);
});

test('The script falls back to using insertBefore or appendChild and restores state if moveBefore is not supported', async ({ page }) => {
  await page.addInitScript(() => {
    const customWindow = window as any;
    customWindow.__fallbackCalled = false;

    // Delete moveBefore so it's not supported
    delete (Element.prototype as any).moveBefore;

    // Spy on insertBefore and appendChild. Emulate older browser behavior
    // where reparenting an open modal automatically closed it (removing 'open' attribute)
    const originalInsertBefore = Element.prototype.insertBefore;
    Element.prototype.insertBefore = function<T extends Node>(this: Element, node: T, ref: Node | null): T {
      if (node instanceof Element && (node.tagName.toLowerCase() === 'dialog' || node.hasAttribute('popover'))) {
        customWindow.__fallbackCalled = true;
        if (node.tagName.toLowerCase() === 'dialog' && node.hasAttribute('open')) {
          node.removeAttribute('open');
        }
      }
      return originalInsertBefore.call(this, node, ref) as T;
    };

    const originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function<T extends Node>(this: Element, node: T): T {
      if (node instanceof Element && (node.tagName.toLowerCase() === 'dialog' || node.hasAttribute('popover'))) {
        customWindow.__fallbackCalled = true;
        if (node.tagName.toLowerCase() === 'dialog' && node.hasAttribute('open')) {
          node.removeAttribute('open');
        }
      }
      return originalAppendChild.call(this, node) as T;
    };
  });

  await page.goto(TARGET_FILE_URL);

  // Open the top-layer element
  const openBtn = page.locator('button:visible', { hasText: /open|feedback|show|trigger|modal/i }).first();
  await openBtn.click();

  // Mark original parent
  const topLayer = page.locator('dialog, [popover]').first();
  await topLayer.evaluate(el => {
    (el.parentElement as any).__initial_parent_marker = true;
  });

  // Move the top-layer element
  await clickMoveButton(page);

  const result = await page.evaluate(() => {
    const customWindow = window as any;
    const el = document.querySelector('dialog, [popover]');
    if (!el) return { fallbackCalled: false, isOpen: false, parentChanged: false };
    const isOpen = el.matches(':modal') || el.matches(':popover-open') || document.fullscreenElement === el;
    const parentChanged = !(el.parentElement as any)?.__initial_parent_marker;
    return {
      fallbackCalled: customWindow.__fallbackCalled,
      isOpen,
      parentChanged
    };
  });

  expect(result.fallbackCalled && result.isOpen && result.parentChanged).toBe(true);
});
