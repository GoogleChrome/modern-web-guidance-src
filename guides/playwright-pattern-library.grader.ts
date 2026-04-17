import { test, expect } from '@playwright/test';

test.describe('Playwright Pattern Library (Best Practices)', () => {
  
  test('Pattern 1: Checking Computed Styles (Behavioral)', async ({ page }) => {
    await page.goto('data:text/html,<div class="target" style="color: red;">Hello</div>');
    
    // GOOD: Check computed style in the browser
    const color = await page.$eval('.target', el => window.getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 0, 0)');
  });

  test('Pattern 2: Mocking Feature Support (addInitScript)', async ({ page }) => {
    // Mock CSS.supports to report no support for :has()
    await page.addInitScript(() => {
      const originalSupports = CSS.supports;
      CSS.supports = function(...args: any[]) {
        if (args[0] === 'selector(:has(*))') return false;
        return originalSupports.apply(this, args as any);
      } as any;
    });
    
    await page.goto('data:text/html,<script>window.hasSupport = CSS.supports("selector(:has(*))")</script>');
    const hasSupport = await page.evaluate(() => (window as any).hasSupport);
    expect(hasSupport).toBe(false);
  });

  test('Pattern 3: Layout Checks (getBoundingClientRect)', async ({ page }) => {
    await page.goto('data:text/html,<div id="a" style="height: 100px;">A</div><div id="b">B</div>');
    
    // GOOD: Check relative positions
    const positions = await page.evaluate(() => {
      const a = document.getElementById('a')!.getBoundingClientRect();
      const b = document.getElementById('b')!.getBoundingClientRect();
      return { aBottom: a.bottom, bTop: b.top };
    });
    
    expect(positions.bTop).toBeGreaterThanOrEqual(positions.aBottom);
  });

  test('Pattern 4: In-Browser CSSOM Traversal (Authored Styles)', async ({ page }) => {
    await page.goto('data:text/html,<style>.target { field-sizing: content; }</style><div class="target">Hello</div>');
    
    // GOOD: Extract authored value when computed style resolves keywords to pixels
    const authoredValue = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText === '.target') {
            return rule.style.getPropertyValue('field-sizing');
          }
        }
      }
      return null;
    });
    
    expect(authoredValue).toBe('content');
  });
});
