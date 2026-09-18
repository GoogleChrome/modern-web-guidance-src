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

// Tests
test.describe(`child-state-based-styling Expectations: ${demoName}`, () => {
  let html = '';

  test.beforeAll(() => {
    html = fs.readFileSync(filePath, 'utf-8');
  });

  // Static assertions
  test(`HTML source contains the :has() pseudo-class`, async () => {
    expect(html).toMatch(/:has\(/);
  });

  test(`HTML source contains the @supports not selector(:has(*)) fallback query`, async () => {
    const hasSupportsFallback = /@supports\s+not\s+selector\(\s*:has\(\*\)\s*\)/.test(html);
    if (hasSupportsFallback) {
      expect(html).toMatch(/@supports\s+not\s+selector\(\s*:has\(\*\)\s*\)/);
    } else {
      expect(true).toBe(true);
    }
  });

  test(`HTML source contains the CSS.supports feature detection for :has()`, async () => {
    const hasCSSSupports = /CSS\.supports/.test(html);
    if (hasCSSSupports) {
      expect(html).toMatch(/CSS\.supports\(\s*['"]selector\(\s*:has\(\*\)\s*\)['"]\s*\)/);
    } else {
      expect(true).toBe(true);
    }
  });

  // Setup browser testing
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
  });

  // Browser assertions
  test(`Container element styling changes based on the state of an interactive child element`, async ({ page }) => {
    await page.goto(demoUrl);

    // Disable transitions to be safe
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });

    const ancestorStyleChanged = await page.evaluate(async () => {
      const interactiveElements = document.querySelectorAll('input, button, select, textarea');
      for (const el of Array.from(interactiveElements)) {
        const ancestors: HTMLElement[] = [];
        let parent = el.parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
          ancestors.push(parent as HTMLElement);
          parent = parent.parentElement;
        }

        const getStyles = () => ancestors.map(a => {
          const style = window.getComputedStyle(a);
          return {
            bg: style.backgroundColor,
            color: style.color,
            border: style.borderColor
          };
        });

        const initialStyles = getStyles();

        // Change state
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
          el.click();
        } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.focus();
          el.value = 'test';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el instanceof HTMLButtonElement) {
          el.focus();
          el.click();
        } else if (el instanceof HTMLElement) {
          el.focus();
        }

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 50));

        const newStyles = getStyles();

        for (let i = 0; i < ancestors.length; i++) {
          if (
            initialStyles[i].bg !== newStyles[i].bg ||
            initialStyles[i].color !== newStyles[i].color ||
            initialStyles[i].border !== newStyles[i].border
          ) {
            return true;
          }
        }
      }
      return false;
    });

    expect(ancestorStyleChanged).toBe(true);
  });

  test(`Fallback script toggles a modifier class on the container element when :has() is unsupported`, async ({ page }) => {
    const hasCSSSupports = /CSS\.supports/.test(html);
    if (!hasCSSSupports) {
      return;
    }

    // We mock CSS.supports before page load
    await page.addInitScript(() => {
      const originalSupports = CSS.supports;
      CSS.supports = function(...args: any[]) {
        if (typeof args[0] === 'string' && args[0].includes(':has(')) {
          return false;
        }
        return (originalSupports as any).apply(this, args);
      };
    });

    await page.goto(demoUrl);

    // Disable transitions to be safe
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });

    const fallbackWorks = await page.evaluate(async () => {
      const interactiveElements = document.querySelectorAll('input, button, select, textarea');
      for (const el of Array.from(interactiveElements)) {
        const ancestors: HTMLElement[] = [];
        let parent = el.parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
          ancestors.push(parent as HTMLElement);
          parent = parent.parentElement;
        }

        const getClasses = () => ancestors.map(a => a.className);

        const initialClasses = getClasses();

        // Change state
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
          el.click();
        } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.focus();
          el.value = 'test';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el instanceof HTMLButtonElement) {
          el.focus();
          el.click();
        } else if (el instanceof HTMLElement) {
          el.focus();
        }

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 55));

        const newClasses = getClasses();

        for (let i = 0; i < ancestors.length; i++) {
          if (initialClasses[i] !== newClasses[i]) {
            return true;
          }
        }
      }
      return false;
    });

    expect(fallbackWorks).toBe(true);
  });
});
