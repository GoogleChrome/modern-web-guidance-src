import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html');
const fileUrl = `file://${targetFile}`;

test.describe('Brand-Consistent Forms Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(fileUrl);
  });

  test('The implementation MUST use the accent-color CSS property to apply a custom color to form controls', async ({ page }) => {
    const accentColor = await page.evaluate(() => {
      // Find any input, progress, or the body/root and see if accent-color is customized (not auto)
      const elTypes = ['body', 'input[type="checkbox"]', 'input[type="radio"]', 'input[type="range"]', 'progress'];
      for (const selector of elTypes) {
        const el = document.querySelector(selector);
        if (el) {
          const comp = window.getComputedStyle(el).accentColor;
          if (comp && comp !== 'auto' && comp !== 'normal') {
            return comp;
          }
        }
      }
      return 'auto';
    });
    expect(accentColor).not.toEqual('auto');
    expect(accentColor).not.toEqual('normal');
  });

  test('The implementation MUST target at least one of the following elements with accent-color: checkbox, radio, range, or progress', async ({ page }) => {
    const targeted = await page.evaluate(() => {
      const elTypes = ['input[type="checkbox"]', 'input[type="radio"]', 'input[type="range"]', 'progress'];
      for (const selector of elTypes) {
        const el = document.querySelector(selector);
        if (el) {
          const comp = window.getComputedStyle(el).accentColor;
          if (comp && comp !== 'auto' && comp !== 'normal') {
            return true;
          }
        }
      }
      return false;
    });
    expect(targeted).toBe(true);
  });

  test('The implementation MUST use color-scheme: light dark (in CSS or meta tag) to enable appropriate default styling for forms in dark mode', async ({ page }) => {
    const colorSchemeValid = await page.evaluate(() => {
      const htmlCS = window.getComputedStyle(document.documentElement).colorScheme;
      const bodyCS = window.getComputedStyle(document.body).colorScheme;
      if (htmlCS.includes('light') && htmlCS.includes('dark')) return true;
      if (bodyCS.includes('light') && bodyCS.includes('dark')) return true;

      // Grader resilience: also check if a form or any parent element of the form has color-scheme light dark defined
      const form = document.querySelector('form');
      if (form) {
        const formCS = window.getComputedStyle(form).colorScheme;
        if (formCS.includes('light') && formCS.includes('dark')) return true;
        
        let parent = form.parentElement;
        while (parent) {
          const parentCS = window.getComputedStyle(parent).colorScheme;
          if (parentCS.includes('light') && parentCS.includes('dark')) return true;
          parent = parent.parentElement;
        }
      }

      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        const content = meta.getAttribute('content') || '';
        if (content.includes('light') && content.includes('dark')) {
          return true;
        }
      }
      return false;
    });
    expect(colorSchemeValid).toBe(true);
  });

  test('The implementation MUST update the accent-color value for dark mode using a prefers-color-scheme media query', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const lightColor = await page.evaluate(() => {
      const el = document.querySelector('input[type="checkbox"]') || document.body;
      return window.getComputedStyle(el).accentColor;
    });

    await page.emulateMedia({ colorScheme: 'dark' });
    const darkColor = await page.evaluate(() => {
      const el = document.querySelector('input[type="checkbox"]') || document.body;
      return window.getComputedStyle(el).accentColor;
    });

    expect(lightColor).not.toEqual('auto');
    expect(darkColor).not.toEqual('auto');
    expect(lightColor).not.toEqual(darkColor);
  });

  test('Every <input> control MUST have an explicit id attribute, and its wrapping/associated <label> MUST explicitly set the for attribute matching the inputs ID', async ({ page }) => {
    const inputsValid = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;

      for (const input of inputs) {
        const id = input.getAttribute('id');
        if (!id) return false;

        const label = document.querySelector(`label[for="${id}"]`);
        if (!label) return false;
      }
      return true;
    });
    expect(inputsValid).toBe(true);
  });
});
