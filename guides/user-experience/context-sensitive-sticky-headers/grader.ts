import { test, expect } from '../../test-fixture.ts';
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

test.describe(`Context-Sensitive Sticky Headers Expectations: ${demoName}`, () => {

  test.use({
    launchOptions: {
      args: ['--enable-experimental-web-platform-features'],
    },
  });

  test.beforeEach(async ({ page, TARGET_URL }) => {
    if (TARGET_URL.startsWith('http://localhost/')) {
      await page.route('http://localhost/**', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }
    await page.goto(TARGET_URL);
  });

  test('Header container should use position: sticky', async ({ page }) => {
    const elements = page.locator('.sticky-container');
    const count = await elements.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const position = await elements.nth(i).evaluate(el => getComputedStyle(el).position);
      expect(position).toBe('sticky');
    }
  });

  test('Header container should define container-type: scroll-state', async ({ page }) => {
    const elements = page.locator('.sticky-container');
    const count = await elements.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const containerType = await elements.nth(i).evaluate(el => {
        // @ts-ignore
        return getComputedStyle(el).containerType || getComputedStyle(el).getPropertyValue('container-type');
      });
      expect(containerType).toContain('scroll-state');
    }
  });

  test('Header container should define container-name: section-header', async ({ page }) => {
    const elements = page.locator('.sticky-container');
    const count = await elements.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const containerName = await elements.nth(i).evaluate(el => {
        // @ts-ignore
        return getComputedStyle(el).containerName || getComputedStyle(el).getPropertyValue('container-name');
      });
      expect(containerName).toBe('section-header');
    }
  });

  test('Header visual style should change when stuck at the top', async ({ page }) => {
    const header = page.locator('.sticky-header').first();
    
    // Ensure we start at the top (unstuck)
    await page.evaluate(() => window.scrollTo(0, 0));
    
    // Wait for header to be at its natural position (top > 0)
    await page.waitForFunction(() => {
      const el = document.querySelector('.sticky-header');
      if (!el) return false;
      return el.getBoundingClientRect().top > 0;
    }, { timeout: 5000 });

    const headerRect = await header.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });

    const initialStyles = await header.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        paddingTop: parseFloat(style.paddingTop),
        paddingBottom: parseFloat(style.paddingBottom),
      };
    });

    // Assert header is actually unstuck
    expect(headerRect.top).toBeGreaterThan(0);

    // Scroll to make it stick (past its natural position)
    await page.evaluate((args) => {
      window.scrollTo(0, args.top + args.height + 50);
    }, headerRect);

    // Wait for style change (polling)
    await page.waitForFunction((args) => {
      const el = document.querySelector(args.selector);
      if (!el) return false;
      const style = getComputedStyle(el);
      const pt = parseFloat(style.paddingTop);
      const pb = parseFloat(style.paddingBottom);
      
      // Check for blue-ish color (high blue channel)
      const rgb = style.backgroundColor.match(/\d+/g);
      const isBlue = rgb ? (Number(rgb[2]) > Number(rgb[0]) && Number(rgb[2]) > Number(rgb[1]) && Number(rgb[2]) > 100) : false;
      
      // Check that background changed AND padding decreased AND it is blue
      return style.backgroundColor !== args.initialBg && 
             (pt < args.initialPt || pb < args.initialPb) &&
             isBlue;
    }, { 
      selector: '.sticky-header', 
      initialBg: initialStyles.backgroundColor,
      initialPt: initialStyles.paddingTop,
      initialPb: initialStyles.paddingBottom
    }, { timeout: 5000 });

    const stuckStyles = await header.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        paddingTop: parseFloat(style.paddingTop),
        paddingBottom: parseFloat(style.paddingBottom),
      };
    });

    // Assert specific changes
    expect(stuckStyles.paddingTop).toBeLessThan(initialStyles.paddingTop);
    expect(stuckStyles.backgroundColor).not.toBe(initialStyles.backgroundColor);
    
    const rgb = stuckStyles.backgroundColor.match(/\d+/g);
    const isBlue = rgb ? (Number(rgb[2]) > Number(rgb[0]) && Number(rgb[2]) > Number(rgb[1]) && Number(rgb[2]) > 100) : false;
    expect(isBlue).toBe(true);

    // Scroll back to 0 and assert revert
    await page.evaluate(() => window.scrollTo(0, 0));

    // Wait for style to revert
    await page.waitForFunction((args) => {
      const el = document.querySelector(args.selector);
      if (!el) return false;
      const style = getComputedStyle(el);
      const pt = parseFloat(style.paddingTop);
      const pb = parseFloat(style.paddingBottom);
      return style.backgroundColor === args.initialBg && 
             pt === args.initialPt && 
             pb === args.initialPb;
    }, { 
      selector: '.sticky-header', 
      initialBg: initialStyles.backgroundColor,
      initialPt: initialStyles.paddingTop,
      initialPb: initialStyles.paddingBottom
    }, { timeout: 5000 });
  });

  test('Visual style changes should be implemented using @container scroll-state(...)', async ({ page }) => {
    const hasScrollStateQuery = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.some(sheet => {
        try {
          const rules = Array.from(sheet.cssRules);
          return rules.some(rule => {
            // @ts-ignore - conditionText might not be on all rules
            const condition = rule.conditionText || '';
            const normalized = condition.replace(/\s+/g, '');
            const hasScrollState = normalized.includes('scroll-state');
            const hasValidStuck = normalized.includes('stuck:top') || 
                                  normalized.includes('stuck:inset-block-start') || 
                                  normalized.includes('stuck:inset-inline-start');
            
            if (hasScrollState && hasValidStuck) {
              return true;
            }
            
            // Some browsers might not put it in conditionText but we can check the constructor name or other props
            if (rule.constructor.name === 'CSSContainerRule') {
               const cssText = rule.cssText.replace(/\s+/g, '');
               const hasCssScrollState = cssText.includes('scroll-state');
               const hasCssValidStuck = cssText.includes('stuck:top') || 
                                        cssText.includes('stuck:inset-block-start') || 
                                        cssText.includes('stuck:inset-inline-start');
               return hasCssScrollState && hasCssValidStuck;
            }
            return false;
          });
        } catch (e) {
          return false;
        }
      });
    });
    expect(hasScrollStateQuery).toBe(true);
  });

  test('Stuck styles must come from the container query, not JS', async ({ page }) => {
    const header = page.locator('.sticky-header').first();
    
    const headerRect = await header.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });

    const initialStyles = await header.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        paddingTop: parseFloat(style.paddingTop),
      };
    });

    // Scroll to stick (past its natural position)
    await page.evaluate((args) => {
      window.scrollTo(0, args.top + args.height + 50);
    }, headerRect);

    // Wait for style change
    await page.waitForFunction((args) => {
      const el = document.querySelector(args.selector);
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.backgroundColor !== args.initialBg;
    }, { selector: '.sticky-header', initialBg: initialStyles.backgroundColor }, { timeout: 5000 });

    // Delete the container query rule (recursively)
    await page.evaluate(() => {
      function deleteRuleRecursive(ruleList: any, sheetOrParent: any) {
        for (let i = ruleList.length - 1; i >= 0; i--) {
          const r = ruleList[i];
          // @ts-ignore
          const condition = r.conditionText || '';
          const normalized = condition.replace(/\s+/g, '');
          
          const hasValidStuck = normalized.includes('stuck:top') || 
                                normalized.includes('stuck:inset-block-start') || 
                                normalized.includes('stuck:inset-inline-start');
          
          if (normalized.includes('scroll-state') && hasValidStuck) {
            // Delete the rule from its parent list
            // @ts-ignore
            sheetOrParent.deleteRule(i);
          } else if (r.cssRules) {
            deleteRuleRecursive(r.cssRules, r);
          }
        }
      }

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          deleteRuleRecursive(sheet.cssRules, sheet);
        } catch {}
      }
    });

    // Assert styles revert to initial
    await page.waitForFunction((args) => {
      const el = document.querySelector(args.selector);
      if (!el) return false;
      const style = getComputedStyle(el);
      const pt = parseFloat(style.paddingTop);
      return style.backgroundColor === args.initialBg && pt === args.initialPt;
    }, { 
      selector: '.sticky-header', 
      initialBg: initialStyles.backgroundColor,
      initialPt: initialStyles.paddingTop
    }, { timeout: 5000 });

    // Second arm: scroll away and back and verify it DOES NOT re-acquire stuck styles
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300); // let any scroll handler run
    
    await page.evaluate((args) => {
      window.scrollTo(0, args.top + args.height + 50);
    }, headerRect);
    await page.waitForTimeout(300);

    const stillHasStuckLook = await header.evaluate((el, args) => {
      const style = getComputedStyle(el);
      return style.backgroundColor !== args.initialBg;
    }, { initialBg: initialStyles.backgroundColor });

    expect(stillHasStuckLook).toBe(false);
  });  test('Existing navigation bar should remain intact', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
    
    const logo = page.locator('nav .logo');
    await expect(logo).toBeVisible();
    
    const containerType = await nav.evaluate(el => {
      // @ts-ignore
      return getComputedStyle(el).containerType || getComputedStyle(el).getPropertyValue('container-type');
    });
    expect(containerType).not.toContain('scroll-state');
  });

});
