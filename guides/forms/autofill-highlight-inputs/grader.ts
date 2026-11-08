import { test, expect, expectNever } from '../../../src/grading/test-fixture.ts';
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
    const hasAutofill = /(?<!-):autofill\b/i.test(css);
    expect(hasAutofill).toBe(true);
  });

  test('The incorrect spelling :auto-fill must not be used', () => {
    const css = getAllCssText();
    expect(getAutofillRules(css).length).toBeGreaterThan(0);
    expect(/:(?:-webkit-)?auto-fill\b/i.test(css)).toBe(false);
  });

  test('The :autofill pseudo-class must only be applied to <input>, <select>, or <textarea>', () => {
    const css = getAllCssText();
    const rules = getAutofillRules(css);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const selectors = rule.selector.split(',').map(s => s.trim());
      for (const sel of selectors) {
        if (!/:(?:-webkit-)?auto-?fill\b/i.test(sel)) continue;
        const match = sel.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)(?::[a-zA-Z-()]*)?:(?:-webkit-)?auto-?fill\b/i);
        if (match) {
          const tag = match[1].toLowerCase();
          expect(['input', 'select', 'textarea']).toContain(tag);
        }
        const isMatch = sel.match(/:(?:is|where)\(([^)]+)\):(?:-webkit-)?auto-?fill\b/i);
        if (isMatch) {
          const tags = isMatch[1].split(',').map(t => t.trim().toLowerCase());
          for (const t of tags) {
            expect(['input', 'select', 'textarea']).toContain(t);
          }
        }
      }
    }
  });

  test('If :-webkit-autofill is used, it must be combined with :autofill inside :is()', () => {
    const css = getAllCssText();
    const rules = getAutofillRules(css);
    expect(rules.length).toBeGreaterThan(0);
    const webkitRules = rules.filter(r => /:-webkit-autofill\b/i.test(r.selector));
    for (const r of webkitRules) {
      const stripped = r.selector.replace(
        /:is\(\s*(?::autofill\s*,\s*:-webkit-autofill|:-webkit-autofill\s*,\s*:autofill)\s*\)/gi,
        ''
      );
      expect(/:-webkit-autofill\b/i.test(stripped)).toBe(false);
    }
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
    expect(getAutofillRules(getAllCssText()).length).toBeGreaterThan(0);
    let controls = await page.locator('input:not([type="submit"]):not([type="button"]), select, textarea').all();
    if (controls.length === 0) {
      await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'text';
        document.body.appendChild(input);
      });
      controls = await page.locator('input:not([type="submit"]):not([type="button"]), select, textarea').all();
    }
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      await control.fill('Test Value').catch(() => {});
    }

    await expectNever(
      page,
      () => Array.from(document.querySelectorAll('input, select, textarea')).some((el: any) => el.style.length > 0),
      { forMs: 300 }
    );
  });

  test('The autofilled state must not change layout-affecting properties (border-width, padding, font-size)', () => {
    const rules = getAutofillRules(getAllCssText()).filter(
      r => !/:focus(?:-visible)?\b/i.test(r.selector)
    );
    expect(rules.length).toBeGreaterThan(0);
    const combinedBody = rules.map(r => r.body).join('\n');
    const changesLayout = /\b(?:border-(?:(?:top|right|bottom|left|inline|block)(?:-\w+)?-)?width|padding(?:-[\w-]+)?|font-size)\s*:/i.test(combinedBody);
    expect(changesLayout).toBe(false);
  });

  test('At least one non-color indicator must be used to style the autofilled state', () => {
    const rules = getAutofillRules(getAllCssText()).filter(
      r => !/:focus(?:-visible)?\b/i.test(r.selector)
    );
    expect(rules.length).toBeGreaterThan(0);
    const combinedBody = rules.map(r => r.body).join('\n');
    const hasInsetBoxShadow = /\bbox-shadow\s*:[^;]*\binset\b/i.test(combinedBody);
    const hasOutline = /\boutline\s*:\s*(?!none\b|0\b)[^;]+|\boutline-(?:width|style)\s*:/i.test(combinedBody);
    const hasOtherNonColor = /\b(?:border-style|text-decoration|font-weight|background-image)\s*:/i.test(combinedBody);
    expect(hasInsetBoxShadow || hasOutline || hasOtherNonColor).toBe(true);
  });

  test('If a custom fill is applied to the autofilled state, it must use an inset box-shadow, not background-color', () => {
    const rules = getAutofillRules(getAllCssText()).filter(
      r => !/:focus(?:-visible)?\b/i.test(r.selector)
    );
    expect(rules.length).toBeGreaterThan(0);
    const combinedBody = rules.map(r => r.body).join('\n');
    const usesBackgroundColor = /\bbackground(?:-color)?\s*:/i.test(combinedBody);
    expect(usesBackgroundColor).toBe(false);
  });

  test('outline: none must not be applied to autofilled elements', () => {
    const css = getAllCssText();
    const rules = getAutofillRules(css);
    expect(rules.length).toBeGreaterThan(0);
    const removesOutline = rules.some(r => /\boutline\s*:\s*(?:none|0)\b/i.test(r.body));
    expect(removesOutline).toBe(false);
  });

  test('If outline is used to style autofilled elements, the :autofill:focus-visible state must have an outline that differs in more than color', () => {
    const rules = getAutofillRules(getAllCssText());
    expect(rules.length).toBeGreaterThan(0);
    const nonFocusRules = rules.filter(r => !/:focus(?:-visible)?\b/i.test(r.selector));
    const nonFocusBody = nonFocusRules.map(r => r.body).join('\n');
    const autofillUsesOutline = /\boutline(?:-(?:width|style|color|offset))?\s*:/i.test(nonFocusBody);

    const focusRule = rules.find(
      r =>
        /:(?:-webkit-)?autofill[^,{]*:focus(?:-visible)?\b/i.test(r.selector) ||
        /:focus(?:-visible)?[^,{]*:(?:-webkit-)?autofill\b/i.test(r.selector)
    );
    const focusHasDistinctOutline = Boolean(
      focusRule &&
      (/\boutline-(?:width|style|offset)\s*:/i.test(focusRule.body) ||
        /\boutline\s*:\s*(?!none\b|0\b)[^;]*\b(?:\d+(?:\.\d+)?(?:px|rem|em)|thin|medium|thick|dashed|dotted|double|solid)\b/i.test(focusRule.body))
    );
    expect(!autofillUsesOutline || focusHasDistinctOutline).toBe(true);
  });

});
