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
test.describe(`Custom Select Picker Layouts Expectations: ${demoName}`, () => {
  // Static & browser assertions
  test(`MUST include appearance: base-select on select and select::picker(select)`, async ({ page }) => {
    const hasBaseSelect = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      return selects.some((sel) => {
        const selectApp = getComputedStyle(sel).appearance;
        const pickerApp = getComputedStyle(sel, '::picker(select)').appearance;
        return selectApp === 'base-select' && pickerApp === 'base-select';
      });
    });
    expect(hasBaseSelect).toBe(true);
  });

  test(`MUST use a non-traditional layout (such as display: grid or flex) on picker container`, async ({ page }) => {
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    await select.click();
    const pickerDisplay = await select.evaluate((el) => getComputedStyle(el, '::picker(select)').display);
    expect(['grid', 'inline-grid', 'flex', 'inline-flex']).toContain(pickerDisplay);
  });

  test(`MUST style option elements to fit the chosen layout`, async ({ page }) => {
    const hasOptionStyles = await page.evaluate(() => {
      const checkRules = (rules: CSSRuleList, parentSelector = ''): boolean => {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i] as any;
          let currentSelector = parentSelector;
          if (rule.selectorText) {
            currentSelector = parentSelector
              ? `${parentSelector} ${rule.selectorText}`
              : rule.selectorText;
            if (/(?:^|[\s,>+~(&])option(?=$|[\s,>+~:[)])/i.test(currentSelector) && rule.style) {
              const disp = rule.style.display;
              const hasLayoutDisplay = ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(disp);
              const hasPadding = Boolean(
                rule.style.padding ||
                rule.style.paddingTop ||
                rule.style.paddingRight ||
                rule.style.paddingBottom ||
                rule.style.paddingLeft ||
                rule.style.paddingBlockStart ||
                rule.style.paddingBlockEnd ||
                rule.style.paddingInlineStart ||
                rule.style.paddingInlineEnd
              );
              if (hasLayoutDisplay || hasPadding) {
                return true;
              }
            }
          }
          if (rule.cssRules && checkRules(rule.cssRules, currentSelector)) {
            return true;
          }
        }
        return false;
      };

      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i].cssRules;
          if (rules && checkRules(rules)) return true;
        } catch {
          // Ignore cross-origin stylesheets
        }
      }
      return false;
    });
    expect(hasOptionStyles).toBe(true);
  });


  test(`MUST communicate checked state of options using multiple visual cues`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/font-weight:|border/i.test(html)).toBe(true);
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

    await page.goto(demoUrl);
  });

  // Browser assertions
  test(`MUST contain a button tag directly inside the select element`, async ({ page }) => {
    const count = await page.locator('select > button').count();
    expect(count).toBeGreaterThan(0);
  });

  test(`MUST contain selectedcontent and NOT legacy selectedoption in the custom trigger button`, async ({ page }) => {
    const count = await page.locator('select > button:has(selectedcontent):not(:has(selectedoption))').count();
    expect(count).toBeGreaterThan(0);
  });

  test(`MUST NOT rely on JS to position options (should not have display: none on native select)`, async ({ page }) => {
    await expect(page.locator('select').first()).not.toHaveCSS('display', 'none');
  });

  test(`MUST have a name attribute on the select element`, async ({ page }) => {
    const count = await page.locator('select[name]').count();
    expect(count).toBeGreaterThan(0);
  });

  test(`MUST have an associated label for the select element`, async ({ page }) => {
    const selectId = await page.evaluate(() => document.querySelector('select')?.getAttribute('id') || 'no-id');
    const labelCount = await page.locator(`label[for="${selectId}"], label:has(select)`).count();
    expect(labelCount).toBeGreaterThan(0);
  });
});
