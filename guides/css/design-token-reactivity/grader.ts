import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const rawTargetFile = process.env.TARGET_FILE || path.resolve('demo.html');
const targetFile = path.isAbsolute(rawTargetFile) ? rawTargetFile : path.resolve(rawTargetFile);
const targetDir = path.dirname(targetFile);
const fileName = path.basename(targetFile);
const targetUrl = `http://localhost/${fileName}`;

test.describe('Design Token Reactivity Grader', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const url = new URL(route.request().url());
      let reqPath = decodeURIComponent(url.pathname);
      if (reqPath === '/' || reqPath === '') reqPath = `/${fileName}`;
      const fullPath = path.join(targetDir, reqPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const contentType =
          ext === '.html' ? 'text/html' :
          ext === '.css' ? 'text/css' :
          ext === '.js' || ext === '.mjs' ? 'application/javascript' :
          'application/octet-stream';
        await route.fulfill({
          status: 200,
          contentType,
          body: fs.readFileSync(fullPath),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto(targetUrl);
  });

  test('The implementation uses @container style() queries to respond to changes in custom property values', async ({ page }) => {
    const isReactive = await page.evaluate(() => {
      const noTransStyle = document.createElement('style');
      noTransStyle.textContent = '* { transition: none !important; }';
      document.head.appendChild(noTransStyle);

      const getQueriedPairs = () => {
        const pairs: { prop: string; val: string }[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule.constructor.name === 'CSSContainerRule') {
                const cond = (rule as any).conditionText || '';
                const matches = Array.from(cond.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^)]+)/g));
                for (const m of matches as any[]) {
                  pairs.push({ prop: m[1].trim(), val: m[2].trim() });
                }
              }
            }
          } catch (e) {
            // Ignore cross-origin stylesheet errors
          }
        }
        return pairs;
      };

      const pairs = getQueriedPairs();
      if (pairs.length === 0) {
        noTransStyle.remove();
        return false;
      }

      const allElements = Array.from(document.querySelectorAll('*'));
      let reactiveFound = false;

      for (const el of allElements) {
        if (el === document.documentElement || el === document.body) continue;

        for (const { prop, val } of pairs) {
          if (prop.includes('support')) continue;

          let ancestor = el.parentElement;
          while (ancestor) {
            const inlineOriginalVal = (ancestor as HTMLElement).style.getPropertyValue(prop);
            const getStyles = (element: Element) => {
              const s = getComputedStyle(element);
              return {
                padding: s.padding,
                paddingTop: s.paddingTop,
                paddingBottom: s.paddingBottom,
                paddingLeft: s.paddingLeft,
                paddingRight: s.paddingRight,
              };
            };

            const stylesBefore = getStyles(el);
            (ancestor as HTMLElement).style.setProperty(prop, val);
            const stylesAfter = getStyles(el);

            if (inlineOriginalVal) {
              (ancestor as HTMLElement).style.setProperty(prop, inlineOriginalVal);
            } else {
              (ancestor as HTMLElement).style.removeProperty(prop);
            }

            const changed = Object.keys(stylesBefore).some(
              (p) => stylesBefore[p as keyof typeof stylesBefore] !== stylesAfter[p as keyof typeof stylesAfter]
            );
            if (changed) {
              reactiveFound = true;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          if (reactiveFound) break;
        }
        if (reactiveFound) break;
      }

      noTransStyle.remove();
      return reactiveFound;
    });

    expect(isReactive).toBe(true);
  });

  test('The implementation defines the queried custom property on an ancestor element of the element being styled', async ({ page }) => {
    const hasPropertyOnAncestor = await page.evaluate(() => {
      const noTransStyle = document.createElement('style');
      noTransStyle.textContent = '* { transition: none !important; }';
      document.head.appendChild(noTransStyle);

      const getQueriedPairs = () => {
        const pairs: { prop: string; val: string }[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule.constructor.name === 'CSSContainerRule') {
                const cond = (rule as any).conditionText || '';
                const matches = Array.from(cond.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^)]+)/g));
                for (const m of matches as any[]) {
                  pairs.push({ prop: m[1].trim(), val: m[2].trim() });
                }
              }
            }
          } catch (e) {
            // Ignore
          }
        }
        return pairs;
      };

      const pairs = getQueriedPairs();
      if (pairs.length === 0) {
        noTransStyle.remove();
        return false;
      }

      const allElements = Array.from(document.querySelectorAll('*'));
      let foundOnAncestor = false;

      for (const el of allElements) {
        if (el === document.documentElement || el === document.body) continue;

        for (const { prop, val } of pairs) {
          if (prop.includes('support')) continue;

          let ancestor = el.parentElement;
          while (ancestor) {
            const ancestorVal = getComputedStyle(ancestor).getPropertyValue(prop).trim();
            if (ancestorVal) {
              const inlineOriginalVal = (ancestor as HTMLElement).style.getPropertyValue(prop);
              const getStyles = (element: Element) => {
                const s = getComputedStyle(element);
                return {
                  padding: s.padding,
                  paddingTop: s.paddingTop,
                  paddingBottom: s.paddingBottom,
                  paddingLeft: s.paddingLeft,
                  paddingRight: s.paddingRight,
                };
              };

              const stylesBefore = getStyles(el);
              (ancestor as HTMLElement).style.setProperty(prop, val);
              const stylesAfter = getStyles(el);

              if (inlineOriginalVal) {
                (ancestor as HTMLElement).style.setProperty(prop, inlineOriginalVal);
              } else {
                (ancestor as HTMLElement).style.removeProperty(prop);
              }

              const changed = Object.keys(stylesBefore).some(
                (p) => stylesBefore[p as keyof typeof stylesBefore] !== stylesAfter[p as keyof typeof stylesAfter]
              );
              if (changed && ancestor !== el) {
                foundOnAncestor = true;
                break;
              }
            }
            ancestor = ancestor.parentElement;
          }
          if (foundOnAncestor) break;
        }
        if (foundOnAncestor) break;
      }

      noTransStyle.remove();
      return foundOnAncestor;
    });

    expect(hasPropertyOnAncestor).toBe(true);
  });

  test('The implementation does not use JavaScript for applying the styles that react to custom property changes', async ({ page }) => {
    // We observe mutations on #target-item while the toggle-spacious button is clicked.
    // If the style is updated via container style queries, no DOM / style attribute mutations
    // occur on #target-item itself.
    await page.evaluate(() => {
      const item = document.getElementById('target-item');
      if (item) {
        (window as any).itemMutations = [];
        const observer = new MutationObserver((mutations) => {
          (window as any).itemMutations.push(...mutations.map((m) => ({
            type: m.type,
            attributeName: m.attributeName,
          })));
        });
        observer.observe(item, { attributes: true, childList: true, subtree: true });
      }
    });

    await page.locator('#toggle-spacious').click();

    const mutations = await page.evaluate(() => (window as any).itemMutations || []);
    expect(mutations.length).toBe(0);
  });

  test('The implementation does not attempt to style the container element using its own style query', async ({ page }) => {
    const isSelfStylingFree = await page.evaluate(() => {
      let selfStylingAttempted = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.constructor.name === 'CSSContainerRule') {
              const containerRule = rule as any;
              for (const subRule of Array.from(containerRule.cssRules) as any[]) {
                if (subRule.selectorText) {
                  const matchedElements = Array.from(document.querySelectorAll(subRule.selectorText));
                  for (const el of matchedElements) {
                    if (el.id === 'target-container') {
                      selfStylingAttempted = true;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore
        }
      }
      return !selfStylingFreeAttempted(selfStylingAttempted);

      function selfStylingFreeAttempted(attempted: boolean) {
        return attempted;
      }
    });

    expect(isSelfStylingFree).toBe(true);
  });

  test('The implementation uses custom properties (CSS variables) when querying styles with @container style()', async ({ page }) => {
    const onlyCustomProperties = await page.evaluate(() => {
      let hasStyleQueries = false;
      let allQueriesAreCustomProperties = true;

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.constructor.name === 'CSSContainerRule') {
              const cond = (rule as any).conditionText || '';
              if (cond.includes('style(')) {
                hasStyleQueries = true;
                const styleRegex = /style\(([^)]+)\)/g;
                let match;
                while ((match = styleRegex.exec(cond)) !== null) {
                  const content = match[1].trim();
                  const propName = content.split(':')[0].trim();
                  if (!propName.startsWith('--')) {
                    allQueriesAreCustomProperties = false;
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore
        }
      }
      return hasStyleQueries && allQueriesAreCustomProperties;
    });

    expect(onlyCustomProperties).toBe(true);
  });

  test('The implementation uses a style query to feature-check for container style query support when conditionally displaying UI', async ({ page }) => {
    const usesFeatureCheck = await page.evaluate(async () => {
      const button = document.getElementById('toggle-spacious');
      if (!button) return false;

      const buttonClasses = Array.from(button.classList);
      const matchesButton = (sel: string) => {
        if (sel.includes('toggle-spacious')) return true;
        for (const cls of buttonClasses) {
          if (sel.includes(cls)) return true;
        }
        return false;
      };

      let supportProp: string | null = null;
      let hasBaseDisplayNone = false;
      let hasContainerDisplayReveal = false;

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.selectorText && matchesButton(rule.selectorText)) {
              if (rule.style.display === 'none') {
                hasBaseDisplayNone = true;
              }
            }
            if (rule.constructor.name === 'CSSContainerRule') {
              const containerRule = rule as any;
              const cond = containerRule.conditionText || '';
              for (const subRule of Array.from(containerRule.cssRules) as any[]) {
                if (subRule.selectorText && matchesButton(subRule.selectorText)) {
                  if (cond.includes('style(') && subRule.style && subRule.style.display && subRule.style.display !== 'none') {
                    hasContainerDisplayReveal = true;
                  }
                  const match = cond.match(/--[a-zA-Z0-9_-]+/);
                  if (match) {
                    supportProp = match[0];
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore
        }
      }

      if (!supportProp) return false;

      const originalDisplay = getComputedStyle(button).display;
      document.documentElement.style.setProperty(supportProp, 'initial');
      const displayAfterRemoval = getComputedStyle(button).display;

      document.documentElement.style.removeProperty(supportProp);

      if (originalDisplay !== 'none' && displayAfterRemoval === 'none') {
        return true;
      }

      return originalDisplay !== 'none' && hasBaseDisplayNone && hasContainerDisplayReveal;
    });

    expect(usesFeatureCheck).toBe(true);
  });

});
