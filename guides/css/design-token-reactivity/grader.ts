import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
const targetUrl = `file://${path.isAbsolute(targetFile) ? targetFile : path.resolve(targetFile)}`;

test.describe('Design Token Reactivity Grader', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(targetUrl);
  });

  test('1. Must use @container style() queries to respond to changes in custom property values', async ({ page }) => {
    const isReactive = await page.evaluate(() => {
      const getQueriedProps = () => {
        const props: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule.constructor.name === 'CSSContainerRule') {
                const cond = (rule as any).conditionText || '';
                const matches = cond.match(/--[a-zA-Z0-9_-]+/g);
                if (matches) {
                  props.push(...matches);
                }
              }
            }
          } catch (e) {
            // Ignore cross-origin stylesheet errors
          }
        }
        return [...new Set(props)];
      };

      const props = getQueriedProps();
      if (props.length === 0) return false;

      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        if (el === document.documentElement || el === document.body) continue;
        const parent = el.parentElement;
        if (!parent) continue;

        for (const prop of props) {
          if (prop.includes('support')) continue;

          const originalVal = getComputedStyle(parent).getPropertyValue(prop).trim();
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

          // Change value to trigger query evaluation
          const testVal = originalVal === 'spacious' ? 'compact' : 'spacious';
          (parent as HTMLElement).style.setProperty(prop, testVal);
          const stylesAfter = getStyles(el);

          // Restore
          if (originalVal) {
            (parent as HTMLElement).style.setProperty(prop, originalVal);
          } else {
            (parent as HTMLElement).style.removeProperty(prop);
          }

          const changed = Object.keys(stylesBefore).some(
            (p) => stylesBefore[p as keyof typeof stylesBefore] !== stylesAfter[p as keyof typeof stylesAfter]
          );
          if (changed) {
            return true;
          }
        }
      }
      return false;
    });

    expect(isReactive).toBe(true);
  });

  test('2. Must define the queried custom property on an ancestor element of the element being styled', async ({ page }) => {
    const hasPropertyOnAncestor = await page.evaluate(() => {
      const getQueriedProps = () => {
        const props: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule.constructor.name === 'CSSContainerRule') {
                const cond = (rule as any).conditionText || '';
                const matches = cond.match(/--[a-zA-Z0-9_-]+/g);
                if (matches) {
                  props.push(...matches);
                }
              }
            }
          } catch (e) {
            // Ignore
          }
        }
        return [...new Set(props)];
      };

      const props = getQueriedProps();
      if (props.length === 0) return false;

      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        if (el === document.documentElement || el === document.body) continue;

        for (const prop of props) {
          if (prop.includes('support')) continue;

          let ancestor = el.parentElement;
          while (ancestor) {
            const ancestorVal = getComputedStyle(ancestor).getPropertyValue(prop).trim();
            if (ancestorVal) {
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
              const originalVal = (ancestor as HTMLElement).style.getPropertyValue(prop);

              const newVal = ancestorVal === 'spacious' ? 'compact' : 'spacious';
              (ancestor as HTMLElement).style.setProperty(prop, newVal);
              const stylesAfter = getStyles(el);

              if (originalVal) {
                (ancestor as HTMLElement).style.setProperty(prop, originalVal);
              } else {
                (ancestor as HTMLElement).style.removeProperty(prop);
              }

              const changed = Object.keys(stylesBefore).some(
                (p) => stylesBefore[p as keyof typeof stylesBefore] !== stylesAfter[p as keyof typeof stylesAfter]
              );
              if (changed && ancestor !== el) {
                return true;
              }
            }
            ancestor = ancestor.parentElement;
          }
        }
      }
      return false;
    });

    expect(hasPropertyOnAncestor).toBe(true);
  });

  test('3. Must NOT use JavaScript for applying the styles that react to custom property changes', async ({ page }) => {
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

  test('4. Must NOT attempt to style the container element using its own style query', async ({ page }) => {
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
                    if (el.id === 'target-container' || el.classList.contains('container')) {
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
      return !selfStylingAttempted;
    });

    expect(isSelfStylingFree).toBe(true);
  });

  test('5. Must use custom properties (CSS variables) when querying styles with @container style()', async ({ page }) => {
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

  test('6. Should use a style query to feature-check for container style query support when conditionally displaying UI', async ({ page }) => {
    const usesFeatureCheck = await page.evaluate(async () => {
      const button = document.getElementById('toggle-spacious');
      if (!button) return false;

      let supportProp: string | null = null;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.constructor.name === 'CSSContainerRule') {
              const containerRule = rule as any;
              for (const subRule of Array.from(containerRule.cssRules) as any[]) {
                if (subRule.selectorText && subRule.selectorText.includes('toggle-spacious')) {
                  const cond = containerRule.conditionText || '';
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

      return originalDisplay !== 'none' && displayAfterRemoval === 'none';
    });

    expect(usesFeatureCheck).toBe(true);
  });

});
