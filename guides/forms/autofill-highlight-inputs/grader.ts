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

function getAllCssText(): string {
  const html = fs.readFileSync(filePath, 'utf-8');
  let css = '';
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    css += m[1] + '\n';
  }
  for (const m of html.matchAll(/<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi)) {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (href) {
      const p = path.resolve(targetDir, href[1]);
      if (fs.existsSync(p)) css += fs.readFileSync(p, 'utf-8') + '\n';
    }
  }
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function getAutofillRules(css: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].trim();
    const body = m[2].trim();
    if (/:(?:-webkit-)?autofill\b/i.test(selector)) {
      rules.push({ selector, body });
    }
  }
  return rules;
}

test.describe(`autofill-highlight-inputs Expectations: ${demoName}`, () => {

  // CSS selector checks use the HTML/CSS source because browsers normalize :autofill
  // to :-webkit-autofill in the CSSOM, making stylesheet inspection unreliable.

  test('The :autofill pseudo-class must be applied to a form control', () => {
    const css = getAllCssText();
    const hasAutofill = /:autofill\b/i.test(css) || /:-webkit-autofill\b/i.test(css);
    expect(hasAutofill).toBe(true);
  });

  test('The incorrect spelling :auto-fill must not be used', () => {
    const css = getAllCssText();
    expect(/:auto-fill\b/i.test(css)).toBe(false);
  });

  test('The :autofill pseudo-class must only be applied to <input>, <select>, or <textarea>', () => {
    const css = getAllCssText();
    const matches = [...css.matchAll(/([a-zA-Z][\w-]*):(?:-webkit-)?auto-?fill\b/gi)];
    expect(matches.length).toBeGreaterThan(0);
    const invalidTags = matches.map(m => m[1].toLowerCase()).filter(t => !['input', 'select', 'textarea'].includes(t));
    expect(invalidTags).toHaveLength(0);
  });

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

  test('JavaScript must not apply inline styles to form controls', async ({ page }) => {
    const controls = await page.locator('input:not([type="submit"]):not([type="button"]), select, textarea').all();
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      await control.fill('Test Value').catch(() => {});
    }
    await page.waitForTimeout(1000);

    const hasInlineStyles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .some(el => (el as HTMLElement).style.length > 0);
    });
    expect(hasInlineStyles).toBe(false);
  });

  test('Multiple visual state indicators must be used to style the autofilled state', () => {
    const rules = getAutofillRules(getAllCssText()).filter(
      r => !/:focus(?:-visible)?\b/i.test(r.selector)
    );
    expect(rules.length).toBeGreaterThan(0);
    const combinedBody = rules.map(r => r.body).join('\n');
    const hasBorder = /\bborder(?:-width|-style|-color)?\s*:/i.test(combinedBody);
    const hasBgIndicator = /\bbox-shadow\s*:[^;]*\binset\b|\bbackground(?:-color)?\s*:/i.test(combinedBody);
    expect(hasBorder && hasBgIndicator).toBe(true);
  });

  test('The focus indicator must be preserved on autofilled elements', () => {
    const rules = getAutofillRules(getAllCssText());
    expect(rules.length).toBeGreaterThan(0);
    const focusRule = rules.find(
      r =>
        /:(?:-webkit-)?autofill:focus(?:-visible)?\b/i.test(r.selector) ||
        /:focus(?:-visible)?:(?:-webkit-)?autofill\b/i.test(r.selector)
    );
    expect(focusRule).toBeDefined();
    expect(/\boutline\s*:\s*(?!none\b|0\b)[^;]+/i.test(focusRule!.body)).toBe(true);
  });

});
