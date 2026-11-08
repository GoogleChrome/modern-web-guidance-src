import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSSupportsRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore - package.json lacks "type": "module" in daily-grind, causing tsc module nodenext to flag import.meta
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const all: CSSRule[] = [];
  for (const rule of rules) {
    all.push(rule);
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      all.push(...collectAllRules(rule.cssRules));
    }
  }
  return all;
}

test.describe('faster-spa-view-transitions Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('When content-visibility: hidden is not supported, a @supports not (content-visibility: hidden) fallback rule applies display: none to inactive view elements', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);

    const supportsRules = allRules.filter(
      (r): r is CSSSupportsRule =>
        r instanceof CSSSupportsRule &&
        /\bnot\b/i.test(r.conditionText) &&
        /content-visibility\s*:\s*hidden/i.test(r.conditionText),
    );
    expect(supportsRules.length).toBeGreaterThan(0);

    const hasDisplayNoneFallback = supportsRules.some((sr) => {
      const innerRules = collectAllRules(sr.cssRules);
      return innerRules.some(
        (ir): ir is CSSStyleRule =>
          ir instanceof CSSStyleRule &&
          ir.style.getPropertyValue('display').trim() === 'none',
      );
    });
    expect(hasDisplayNoneFallback).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Inactive view elements have content-visibility: hidden applied in their computed styles', async ({
      page,
    }) => {
      // Navigate across views to ensure lazy-instantiated views are mounted and cached
      await page.locator('nav').getByRole('link', { name: 'Locations' }).click();
      await page.locator('nav').getByRole('link', { name: 'Menu' }).click();

      const state = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('body *'));
        const hiddenViews = allElements.filter(
          (el) => window.getComputedStyle(el).contentVisibility === 'hidden',
        );
        return {
          hiddenCount: hiddenViews.length,
          allHaveHidden:
            hiddenViews.length > 0 &&
            hiddenViews.every(
              (el) => window.getComputedStyle(el).contentVisibility === 'hidden',
            ),
        };
      });

      expect(state.hiddenCount).toBeGreaterThan(0);
      expect(state.allHaveHidden).toBe(true);
    });

    test('When a view element is active, it does not have content-visibility: hidden applied (its computed content-visibility is visible)', async ({
      page,
    }) => {
      await page.locator('nav').getByRole('link', { name: 'Locations' }).click();
      await page.locator('nav').getByRole('link', { name: 'Menu' }).click();

      const state = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('body *'));
        const hiddenViews = allElements.filter(
          (el) => window.getComputedStyle(el).contentVisibility === 'hidden',
        );
        if (hiddenViews.length === 0) {
          return { hiddenCount: 0, activeComputedVisibility: null };
        }
        const parent = hiddenViews[0].parentElement;
        if (!parent) {
          return { hiddenCount: hiddenViews.length, activeComputedVisibility: null };
        }
        const siblings = Array.from(parent.children);
        const activeViews = siblings.filter(
          (el) =>
            !hiddenViews.includes(el) &&
            window.getComputedStyle(el).display !== 'none' &&
            !['NAV', 'FOOTER', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName),
        );
        if (activeViews.length === 0) {
          return { hiddenCount: hiddenViews.length, activeComputedVisibility: null };
        }
        return {
          hiddenCount: hiddenViews.length,
          activeComputedVisibility: window.getComputedStyle(activeViews[0])
            .contentVisibility,
        };
      });

      expect(state.hiddenCount).toBeGreaterThan(0);
      expect(state.activeComputedVisibility).toBe('visible');
    });

    test('Switching between views toggles the content-visibility state between the active and inactive view elements', async ({
      page,
    }) => {
      await page.locator('nav').getByRole('link', { name: 'Menu' }).click();

      // Tag the active Menu view while on Menu (polling to allow async route handlers like hashchange to finish)
      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('body *'));
            const hiddenViews = allElements.filter(
              (el) => window.getComputedStyle(el).contentVisibility === 'hidden',
            );
            if (hiddenViews.length === 0) return false;
            const parent = hiddenViews[0].parentElement;
            if (!parent) return false;
            const siblings = Array.from(parent.children);
            const activeView = siblings.find(
              (el) =>
                !hiddenViews.includes(el) &&
                window.getComputedStyle(el).display !== 'none' &&
                !['NAV', 'FOOTER', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(
                  el.tagName,
                ) &&
                /\bmenu\b/i.test(el.textContent || ''),
            );
            if (!activeView) return false;
            activeView.setAttribute('data-grader-view-menu', 'true');
            return true;
          });
        })
        .toBe(true);

      await page.locator('nav').getByRole('link', { name: 'Locations' }).click();

      // Tag the active Locations view while on Locations and check visibility states
      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('body *'));
            const hiddenViews = allElements.filter(
              (el) => window.getComputedStyle(el).contentVisibility === 'hidden',
            );
            if (hiddenViews.length === 0) return null;
            const parent = hiddenViews[0].parentElement;
            if (!parent) return null;
            const siblings = Array.from(parent.children);
            const menuView = document.querySelector(
              '[data-grader-view-menu="true"]',
            );
            const activeView = siblings.find(
              (el) =>
                el !== menuView &&
                !hiddenViews.includes(el) &&
                window.getComputedStyle(el).display !== 'none' &&
                !['NAV', 'FOOTER', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(
                  el.tagName,
                ) &&
                /\blocations\b/i.test(el.textContent || ''),
            );
            if (!activeView || !menuView) {
              return null;
            }

            activeView.setAttribute('data-grader-view-locations', 'true');

            return {
              locationsVisibility:
                window.getComputedStyle(activeView).contentVisibility,
              menuVisibility:
                window.getComputedStyle(menuView).contentVisibility,
            };
          });
        })
        .toEqual({
          locationsVisibility: 'visible',
          menuVisibility: 'hidden',
        });

      // Switch back to Menu
      await page.locator('nav').getByRole('link', { name: 'Menu' }).click();

      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const locationsView = document.querySelector(
              '[data-grader-view-locations="true"]',
            );
            const menuView = document.querySelector(
              '[data-grader-view-menu="true"]',
            );
            if (!locationsView || !menuView) return null;
            return {
              locationsVisibility:
                window.getComputedStyle(locationsView).contentVisibility,
              menuVisibility:
                window.getComputedStyle(menuView).contentVisibility,
            };
          });
        })
        .toEqual({
          locationsVisibility: 'hidden',
          menuVisibility: 'visible',
        });
    });

    test('Inactive view elements have the inert attribute applied (and removed when active) so hidden content is excluded from the keyboard tab order and accessibility tree', async ({
      page,
    }) => {
      await page.locator('nav').getByRole('link', { name: 'Menu' }).click();

      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('body *'));
            const hiddenViews = allElements.filter(
              (el) => window.getComputedStyle(el).contentVisibility === 'hidden',
            );
            if (hiddenViews.length === 0) return false;
            const parent = hiddenViews[0].parentElement;
            if (!parent) return false;
            const siblings = Array.from(parent.children);
            const activeView = siblings.find(
              (el) =>
                !hiddenViews.includes(el) &&
                window.getComputedStyle(el).display !== 'none' &&
                !['NAV', 'FOOTER', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(
                  el.tagName,
                ) &&
                /\bmenu\b/i.test(el.textContent || ''),
            );
            if (!activeView) return false;
            activeView.setAttribute('data-grader-inert-menu', 'true');
            return true;
          });
        })
        .toBe(true);

      await page.locator('nav').getByRole('link', { name: 'Locations' }).click();

      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('body *'));
            const hiddenViews = allElements.filter(
              (el) => window.getComputedStyle(el).contentVisibility === 'hidden',
            );
            if (hiddenViews.length === 0) return null;
            const parent = hiddenViews[0].parentElement;
            if (!parent) return null;
            const siblings = Array.from(parent.children);
            const menuView = document.querySelector(
              '[data-grader-inert-menu="true"]',
            );
            const activeView = siblings.find(
              (el) =>
                el !== menuView &&
                !hiddenViews.includes(el) &&
                window.getComputedStyle(el).display !== 'none' &&
                !['NAV', 'FOOTER', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(
                  el.tagName,
                ) &&
                /\blocations\b/i.test(el.textContent || ''),
            );
            if (!activeView || !menuView) {
              return null;
            }

            activeView.setAttribute('data-grader-inert-locations', 'true');

            const allInactiveInert = hiddenViews.every(
              (el) =>
                (el as HTMLElement).inert === true || el.hasAttribute('inert'),
            );
            const activeInert =
              (activeView as HTMLElement).inert === true ||
              activeView.hasAttribute('inert');

            return {
              allInactiveInert,
              activeInert,
            };
          });
        })
        .toEqual({
          allInactiveInert: true,
          activeInert: false,
        });

      // Switch back to Menu and verify inert is removed on Menu and applied to Locations
      await page.locator('nav').getByRole('link', { name: 'Menu' }).click();

      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const locationsView = document.querySelector(
              '[data-grader-inert-locations="true"]',
            ) as HTMLElement | null;
            const menuView = document.querySelector(
              '[data-grader-inert-menu="true"]',
            ) as HTMLElement | null;
            if (!locationsView || !menuView) return null;

            return {
              locationsInert:
                locationsView.inert === true ||
                locationsView.hasAttribute('inert'),
              menuInert:
                menuView.inert === true || menuView.hasAttribute('inert'),
            };
          });
        })
        .toEqual({
          locationsInert: true,
          menuInert: false,
        });
    });

    test('Switching to a view moves keyboard focus to the newly active view container', async ({
      page,
    }) => {
      await page.evaluate(() => {
        (window as unknown as { __graderFocusedViews?: Element[] }).__graderFocusedViews = [];
        document.addEventListener(
          'focusin',
          (e) => {
            if (e.target instanceof Element) {
              (
                window as unknown as { __graderFocusedViews: Element[] }
              ).__graderFocusedViews.push(e.target);
            }
          },
          true,
        );
        const origFocus = HTMLElement.prototype.focus;
        HTMLElement.prototype.focus = function (...args) {
          (
            window as unknown as { __graderFocusedViews: Element[] }
          ).__graderFocusedViews.push(this);
          return origFocus.apply(this, args);
        };
      });

      await page.locator('nav').getByRole('link', { name: 'Rewards' }).click();

      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('body *'));
            const hiddenViews = allElements.filter(
              (el) => window.getComputedStyle(el).contentVisibility === 'hidden',
            );
            if (hiddenViews.length === 0) return false;
            const parent = hiddenViews[0].parentElement;
            if (!parent) return false;
            const siblings = Array.from(parent.children);
            const activeView = siblings.find(
              (el) =>
                !hiddenViews.includes(el) &&
                window.getComputedStyle(el).display !== 'none' &&
                !['NAV', 'FOOTER', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName) &&
                /\brewards\b/i.test(el.textContent || ''),
            );
            if (!activeView) return false;

            const recorded =
              (window as unknown as { __graderFocusedViews?: Element[] })
                .__graderFocusedViews || [];

            return (
              document.activeElement === activeView ||
              activeView.contains(document.activeElement) ||
              recorded.some((el) => el === activeView || activeView.contains(el))
            );
          });
        })
        .toBe(true);
    });
  });
});
