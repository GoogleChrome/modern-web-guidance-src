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

test.describe(`child-state-based-styling Expectations: ${demoName}`, () => {
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

  test('The implementation includes a container element containing an interactive child element', async ({ page }) => {
    await page.goto(demoUrl);
    const hasInteractiveChild = await page.evaluate(() => {
      const interactive = document.querySelectorAll('input, button, select, textarea');
      for (const el of Array.from(interactive)) {
        const parent = el.parentElement;
        if (parent && parent !== document.body && parent !== document.documentElement) {
          return true;
        }
      }
      return false;
    });
    expect(hasInteractiveChild).toBe(true);
  });

  test('The state-based styling is implemented with CSS using the :has() selector on the container', async ({ page }) => {
    await page.goto(demoUrl);
    const hasRuleWithHas = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.selectorText.includes(':has(')) {
              return true;
            }
          }
        } catch {}
      }
      return false;
    });
    expect(hasRuleWithHas).toBe(true);
  });

  test('The container element styling changes based on the state of the interactive child element', async ({ page }) => {
    await page.goto(demoUrl);

    // Disable transitions to be safe
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });

    const ancestorStyleChanged = await page.evaluate(() => {
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
            border: style.borderColor,
            shadow: style.boxShadow,
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

        const newStyles = getStyles();

        for (let i = 0; i < ancestors.length; i++) {
          if (
            initialStyles[i].bg !== newStyles[i].bg ||
            initialStyles[i].color !== newStyles[i].color ||
            initialStyles[i].border !== newStyles[i].border ||
            initialStyles[i].shadow !== newStyles[i].shadow
          ) {
            return true;
          }
        }
      }
      return false;
    });

    expect(ancestorStyleChanged).toBe(true);
  });
});
