import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;

if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not set');
}

const fileUrl = `file://${path.resolve(targetFile)}`;

test.describe('Size-Aware Styling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(fileUrl);
  });

  test('The component wrapper has container-type: inline-size or size applied', async ({ page }) => {
    const containerTypeExists = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        const containerType = style.containerType || style.getPropertyValue('container-type');
        return containerType === 'inline-size' || containerType === 'size';
      });
    });
    expect(containerTypeExists).toBe(true);
  });

  test('The component uses container queries to apply styles based on container width', async ({ page }) => {
    // Set a large viewport so viewport media queries (like min-width: 600px) would be active
    await page.setViewportSize({ width: 800, height: 600 });

    const flexDirection = await page.evaluate(() => {
      const findElements = () => {
        let container = document.querySelector('.resizable-container') as HTMLElement | null;
        let card = container ? container.querySelector('.card') as HTMLElement | null : null;
        if (!container) {
          const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
          container = all.find(el => {
            const style = window.getComputedStyle(el);
            const ct = style.containerType || style.getPropertyValue('container-type');
            return ct === 'inline-size' || ct === 'size';
          }) || null;
        }
        if (!card && container) {
          card = (container.querySelector('*') || container) as HTMLElement;
        }
        return { container, card };
      };

      const { container, card } = findElements();
      if (!container || !card) return null;
      container.style.width = '300px';
      return window.getComputedStyle(card).flexDirection;
    });

    expect(flexDirection).toBe('column');
  });

  test('The component changes layout when container width crosses threshold', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });

    const layoutChanged = await page.evaluate(() => {
      const findElements = () => {
        let container = document.querySelector('.resizable-container') as HTMLElement | null;
        let card = container ? container.querySelector('.card') as HTMLElement | null : null;
        if (!container) {
          const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
          container = all.find(el => {
            const style = window.getComputedStyle(el);
            const ct = style.containerType || style.getPropertyValue('container-type');
            return ct === 'inline-size' || ct === 'size';
          }) || null;
        }
        if (!card && container) {
          card = (container.querySelector('*') || container) as HTMLElement;
        }
        return { container, card };
      };

      const { container, card } = findElements();
      if (!container || !card) return false;

      container.style.width = '350px';
      const styleNarrow = window.getComputedStyle(card).flexDirection;

      container.style.width = '450px';
      const styleWide = window.getComputedStyle(card).flexDirection;

      return styleNarrow !== styleWide;
    });

    expect(layoutChanged).toBe(true);
  });

  test('Fallback strategy using media queries or default safe layout is provided', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });

    const fallbackWorks = await page.evaluate(() => {
      let hasSupportsOrContainerRule = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSSupportsRule && rule.conditionText.includes('container-type')) {
              hasSupportsOrContainerRule = true;
            }
            if (rule.constructor.name === 'CSSContainerRule') {
              hasSupportsOrContainerRule = true;
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }

      if (!hasSupportsOrContainerRule) {
        return false;
      }

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
            const rule = sheet.cssRules[i];
            if (
              (rule instanceof CSSSupportsRule && rule.conditionText.includes('container-type')) ||
              rule.constructor.name === 'CSSContainerRule'
            ) {
              sheet.deleteRule(i);
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }

      const card = document.querySelector('.card') as HTMLElement | null;
      if (!card) return false;

      const style = window.getComputedStyle(card).flexDirection;
      return style === 'row';
    });

    expect(fallbackWorks).toBe(true);
  });
});
