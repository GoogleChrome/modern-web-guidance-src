import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import nested from 'postcss-nested';
import shorthandExpand from 'postcss-shorthand-expand';

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
  
  // Extract CSS and parse with PostCSS (including nesting and shorthand expansion)
  const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
  const root = postcss([nested(), shorthandExpand()]).processSync(styles).root;

  test('The :autofill pseudo-class must be applied to a form control', () => {
    let hasAutofill = false;
    root.walkRules(rule => {
      selectorParser(selectors => {
        selectors.walkPseudos(pseudo => {
          if (pseudo.value.toLowerCase() === ':autofill') hasAutofill = true;
        });
      }).processSync(rule.selector);
    });
    expect(hasAutofill).toBe(true);
  });

  test('The incorrect spelling :auto-fill must not be used', () => {
    let hasInvalid = false;
    root.walkRules(rule => {
      selectorParser(selectors => {
        selectors.walkPseudos(pseudo => {
          if (pseudo.value.toLowerCase() === ':auto-fill') hasInvalid = true;
        });
      }).processSync(rule.selector);
    });
    expect(hasInvalid).toBe(false);
  });

  test('The :autofill pseudo-class must only be applied to <input>, <select>, or <textarea>', () => {
    let invalidSelectors: string[] = [];
    
    root.walkRules(rule => {
      selectorParser(selectors => {
        selectors.each(selector => {
          let containsAutofill = false;
          selector.walkPseudos(pseudo => {
            if (pseudo.value.toLowerCase() === ':autofill') containsAutofill = true;
          });

          if (containsAutofill) {
            const firstNode = selector.first;
            const isValidTag = firstNode && firstNode.type === 'tag' && 
                               ['input', 'select', 'textarea'].includes(firstNode.value.toLowerCase());
            
            if (!isValidTag) invalidSelectors.push(selector.toString());
          }
        });
      }).processSync(rule.selector);
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
