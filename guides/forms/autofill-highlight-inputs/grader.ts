import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import { Parser, CSSStyleRule } from '../../../../cssom/src/index.ts';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`autofill-highlight-inputs Expectations: ${demoName}`, () => {
  const html = fs.readFileSync(filePath, 'utf-8');
  const { document } = parseHTML(html);
  
  const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
  const rules = Parser.parseStyleSheetText(styles);
  const styleRules = rules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

  test('The :autofill pseudo-class must be applied to a form control', () => {
    const hasAutofill = styleRules.some(rule => rule.selectorText.includes(':autofill'));
    expect(hasAutofill).toBe(true);
  });

  test('The incorrect spelling :auto-fill must not be used', () => {
    const hasInvalid = styleRules.some(rule => rule.selectorText.includes(':auto-fill'));
    expect(hasInvalid).toBe(false);
  });

  test('The :autofill pseudo-class must only be applied to <input>, <select>, or <textarea>', () => {
    const invalidSelectors: string[] = [];
    
    styleRules.forEach(rule => {
      if (rule.selectorText.includes(':autofill')) {
        const matches = rule.selectorText.split(',');
        matches.forEach(s => {
          const selector = Parser.parseSelector(s);
          if (selector && selector.includes(':autofill')) {
            const isValid = selector.startsWith('input') || 
                            selector.startsWith('select') || 
                            selector.startsWith('textarea');
            if (!isValid) invalidSelectors.push(selector);
          }
        });

      }
    });
    
    expect(invalidSelectors).toHaveLength(0);
  });


  test.describe('Browser tests', () => {
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
  });

});
