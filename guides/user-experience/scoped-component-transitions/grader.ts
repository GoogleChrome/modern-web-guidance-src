/// <reference types="node" />
import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;

test.describe('Scoped Component Transitions', () => {
  test.beforeEach(async () => {
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is required');
    }
  });

  test('At least one element on the page has a computed view-transition-scope value of all', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const hasScopeAll = await page.evaluate(() => {
      const allElements = document.body.querySelectorAll('*');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if ((style as any).viewTransitionScope === 'all') {
          return true;
        }
      }
      return false;
    });
    expect(hasScopeAll).toBe(true);
  });

  test('Every element with a computed view-transition-scope of all must also have layout containment', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const pass = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let foundScopeAll = false;
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if ((style as any).viewTransitionScope === 'all') {
          foundScopeAll = true;
          const contain = style.contain;
          const tokens = contain.split(' ').map(t => t.trim());
          if (!tokens.includes('layout') && contain !== 'strict' && contain !== 'content') {
            return false;
          }
        }
      }
      return foundScopeAll ? true : true; // If none found, technically it passes 'every', but let's let test 1 fail it
    });
    expect(pass).toBe(true);
  });

  test('The <html> root element does NOT have a computed view-transition-scope value of all', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const rootScope = await page.evaluate(() => {
      return (window.getComputedStyle(document.documentElement) as any).viewTransitionScope;
    });
    expect(rootScope).not.toBe('all');
  });

  test('At least two distinct elements on the page have a computed view-transition-name other than none, and both are descendants of an element with view-transition-scope: all', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const validNamesCount = await page.evaluate(() => {
      let count = 0;
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if ((style as any).viewTransitionName && (style as any).viewTransitionName !== 'none') {
          // Check if it's a descendant of an element with view-transition-scope: all
          let current = el.parentElement;
          let isDescendant = false;
          while (current) {
            const currentStyle = window.getComputedStyle(current);
            if ((currentStyle as any).viewTransitionScope === 'all') {
              isDescendant = true;
              break;
            }
            current = current.parentElement;
          }
          if (isDescendant) {
            count++;
          }
        }
      }
      return count;
    });
    expect(validNamesCount).toBeGreaterThanOrEqual(2);
  });

  test('The page\'s JavaScript does NOT call document.startViewTransition', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__docStartViewTransitionCalled = false;
      const original = document.startViewTransition;
      if (original) {
        document.startViewTransition = function(cb) {
          (window as any).__docStartViewTransitionCalled = true;
          return original.call(this, cb);
        };
      }
    });
    await page.goto(`file://${targetFile}`);
    
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      await btn.click();
      await page.waitForTimeout(50);
    }

    const called = await page.evaluate(() => (window as any).__docStartViewTransitionCalled);
    expect(called).toBe(false);
  });

  test('After clicking a button that lives inside (or adjacent to) an element with view-transition-scope: all, the textContent of that scope changes within a short time', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    
    const passed = await page.evaluate(async () => {
      const getScopes = () => {
        const scopes = [];
        const allElements = document.body.querySelectorAll('*');
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          if ((style as any).viewTransitionScope === 'all') {
            scopes.push(el);
          }
        }
        return scopes;
      };

      const scopes = getScopes();
      if (scopes.length === 0) return false;

      const initialText = scopes.map(el => el.textContent);
      
      const buttons = document.querySelectorAll('button');
      if (buttons.length === 0) return false;

      for (const btn of buttons) {
        btn.click();
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const newText = scopes.map(el => el.textContent);
        
        for (let i = 0; i < scopes.length; i++) {
          if (initialText[i] !== newText[i]) {
            return true;
          }
        }
      }
      return false;
    });

    expect(passed).toBe(true);
  });
});
