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

test.use({
  launchOptions: {
    args: ['--enable-experimental-web-platform-features'],
  },
});

test.describe(`State-Aware Sticky Headers Expectations: ${demoName}`, () => {

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

  test('Header container uses position: sticky', async ({ page }) => {
    const elements = page.locator('.sticky-container');
    const count = await elements.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const position = await elements.nth(i).evaluate(el => getComputedStyle(el).position);
      expect(position).toBe('sticky');
    }
  });

  test('Header container defines container-type: scroll-state', async ({ page }) => {
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

  test('Header container defines a container-name', async ({ page }) => {
    const elements = page.locator('.sticky-container');
    const count = await elements.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const containerName = await elements.nth(i).evaluate(el => {
        // @ts-ignore
        return getComputedStyle(el).containerName || getComputedStyle(el).getPropertyValue('container-name');
      });
      expect(containerName).toBeTruthy();
      expect(containerName).not.toBe('none');
    }
  });

  test('Header visual style changes when stuck at the top', async ({ page }) => {
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
      
      // Check for blue-ish color (high blue channel)
      const rgb = style.backgroundColor.match(/\d+/g);
      const isBlue = rgb ? (Number(rgb[2]) > Number(rgb[0]) && Number(rgb[2]) > Number(rgb[1]) && Number(rgb[2]) > 100) : false;
      
      // Check that background changed AND it is blue
      return style.backgroundColor !== args.initialBg && isBlue;
    }, { 
      selector: '.sticky-header', 
      initialBg: initialStyles.backgroundColor
    }, { timeout: 5000 });

    const stuckStyles = await header.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
      };
    });

    // Assert specific changes
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
      return style.backgroundColor === args.initialBg;
    }, { 
      selector: '.sticky-header', 
      initialBg: initialStyles.backgroundColor
    }, { timeout: 5000 });
  });

  test('Layout-affecting stuck styles require overflow-anchor: none on the sticky parent', async ({ page }) => {
    const container = page.locator('.sticky-container').first();

    // Ensure we start unstuck
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => {
      const el = document.querySelector('.sticky-container');
      if (!el) return false;
      return el.getBoundingClientRect().top > 0;
    }, { timeout: 5000 });

    // Deliberately conservative: some of these only cause anchoring
    // oscillation in some layouts, but a binary check cannot cheaply
    // test actual flicker, so any layout-affecting change counts.
    const LAYOUT_PROPS = [
      'height', 'minHeight', 'lineHeight',
      'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
      'marginTop', 'marginBottom', 'fontSize',
      'borderTopWidth', 'borderBottomWidth',
    ];

    const readLayout = () => page.evaluate((props) => {
      const pick = (el: Element) => {
        const style = getComputedStyle(el);
        return props.map((prop) => String(style[prop as keyof CSSStyleDeclaration])).join('|');
      };
      const containerEl = document.querySelector('.sticky-container');
      if (!containerEl) return '';
      const headerEl = containerEl.querySelector('.sticky-header') || containerEl;
      return pick(containerEl) + '||' + pick(headerEl);
    }, LAYOUT_PROPS);

    const unstuck = await readLayout();

    const containerRect = await container.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });

    // Scroll halfway into the container so it is unambiguously stuck
    await page.evaluate((args) => {
      window.scrollTo(0, args.top + args.height / 2);
    }, containerRect);

    const parentOverflowAnchor = await container.evaluate(el =>
      getComputedStyle(el.parentElement!).overflowAnchor
    );

    await expect.poll(async () => {
      const stuck = await readLayout();
      const layoutChanged = stuck !== unstuck;
      if (layoutChanged) {
        return parentOverflowAnchor === 'none';
      } else {
        return parentOverflowAnchor !== 'none';
      }
    }).toBe(true);
  });

  test('Visual style changes are implemented using @container scroll-state(...)', async ({ page }) => {
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
                                  normalized.includes('stuck:block-start');
            
            if (hasScrollState && hasValidStuck) {
              return true;
            }
            
            // Some browsers might not put it in conditionText but we can check the constructor name or other props
            if (rule.constructor.name === 'CSSContainerRule') {
               const cssText = rule.cssText.replace(/\s+/g, '');
               const hasCssScrollState = cssText.includes('scroll-state');
               const hasCssValidStuck = cssText.includes('stuck:top') ||
                                        cssText.includes('stuck:block-start');
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

  test('Stuck styles come from the container query, not JS', async ({ page }) => {
    const header = page.locator('.sticky-header').first();
    
    const headerRect = await header.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });

    const initialStyles = await header.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
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
                                normalized.includes('stuck:block-start');
          
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
      return style.backgroundColor === args.initialBg;
    }, { 
      selector: '.sticky-header', 
      initialBg: initialStyles.backgroundColor
    }, { timeout: 5000 });

    // Second arm: scroll away and back and verify it DOES NOT re-acquire stuck styles
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate((args) => {
      window.scrollTo(0, args.top + args.height + 50);
    }, headerRect);

    await expect.poll(async () => {
      return header.evaluate((el, args) => {
        const style = getComputedStyle(el);
        return style.backgroundColor !== args.initialBg;
      }, { initialBg: initialStyles.backgroundColor });
    }).toBe(false);
  });

  test('Existing navigation bar remains intact', async ({ page }) => {
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

  test('`scroll-padding-top` is used to ensure that elements that receive focus aren\'t obscured by the sticky header.', async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
    });

    const result = await page.evaluate(async () => {
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const htmlPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const bodyPadding = parseFloat(getComputedStyle(document.body).scrollPaddingTop) || 0;
      const scrollPaddingTop = Math.max(htmlPadding, bodyPadding);

      const sticky = document.querySelector('.sticky-container');
      if (!sticky) {
        return {
          hasSticky: false,
          scrollPaddingTop,
          stickyBottom: 0,
          hasTarget: false,
          focusedTop: 0,
        };
      }

      const spacer = document.createElement('div');
      spacer.style.height = '1500px';
      document.body.appendChild(spacer);

      try {
        const stickyDocTop = sticky.getBoundingClientRect().top + window.scrollY;
        const focusables = Array.from(
          document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ).filter((el): el is HTMLElement => {
          if (el.closest('nav') || el.closest('.sticky-container')) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.top + window.scrollY > stickyDocTop;
        });

        window.scrollTo({ top: stickyDocTop + 120, behavior: 'instant' });
        await raf();
        const stickyBottom = sticky.getBoundingClientRect().bottom;

        const target = focusables[0];
        if (!target) {
          return {
            hasSticky: true,
            scrollPaddingTop,
            stickyBottom,
            hasTarget: false,
            focusedTop: 0,
          };
        }

        const targetDocY = target.getBoundingClientRect().top + window.scrollY;
        // Position target in the bottom sliver behind the stuck header so undersized scroll-padding fails to scroll.
        window.scrollTo({ top: Math.max(0, targetDocY - Math.max(4, stickyBottom - 4)), behavior: 'instant' });
        await raf();
        target.blur();
        target.focus();
        await raf();

        const focusedTop = target.getBoundingClientRect().top;
        return {
          hasSticky: true,
          scrollPaddingTop,
          stickyBottom,
          hasTarget: true,
          focusedTop,
        };
      } finally {
        spacer.remove();
      }
    });

    expect(result.hasSticky, 'Expected a .sticky-container element').toBe(true);
    expect(result.scrollPaddingTop, 'Expected non-zero scroll-padding-top').toBeGreaterThan(0);
    expect(
      result.scrollPaddingTop,
      `scroll-padding-top (${result.scrollPaddingTop}px) should be >= stuck sticky header bottom (${result.stickyBottom}px)`,
    ).toBeGreaterThanOrEqual(result.stickyBottom - 0.5);
    expect(result.hasTarget, 'Expected a focusable element below the sticky header').toBe(true);
    expect(
      result.focusedTop,
      `Focused element top (${result.focusedTop}px) should be >= stuck sticky header bottom (${result.stickyBottom}px)`,
    ).toBeGreaterThanOrEqual(result.stickyBottom - 1);
  });

});
