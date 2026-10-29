import {
  test,
  expect,
  skipUnless,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Node } from 'ts-morph';
import { CSSStyleRule, CSSGroupingRule, type CSSRule } from 'cssomnom';

// @ts-ignore - package.json does not declare "type": "module", causing tsc nodenext to infer CJS
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllStyleRules(rule.cssRules));
    }
  }
  return result;
}

function getSwitchInputs(docs: Array<{ file: string; document: any }>): Array<{ document: any; input: any }> {
  const switchInputs: Array<{ document: any; input: any }> = [];
  for (const { document } of docs) {
    const inputs = Array.from(document.querySelectorAll('input')) as any[];
    for (const input of inputs) {
      const type = (input.getAttribute('type') || '').toLowerCase();
      if (type === 'checkbox' && input.hasAttribute('switch')) {
        switchInputs.push({ document, input });
      }
    }
  }
  return switchInputs;
}

test.describe('switch Target Grader', () => {
  test('Each switch control is a standard HTML <input type="checkbox"> element with the switch attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = getSwitchInputs(docs);
    expect(switchInputs.length).toBeGreaterThan(0);
  });

  test('Each switch input is associated with a <label> element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = getSwitchInputs(docs);
    const allHaveLabels =
      switchInputs.length > 0 &&
      switchInputs.every(({ document, input }) => {
        if (input.closest('label')) {
          return true;
        }
        const id = input.getAttribute('id');
        if (!id) {
          return false;
        }
        const labels = Array.from(document.querySelectorAll('label')) as any[];
        return labels.some((label) => label.getAttribute('for') === id);
      });
    expect(allHaveLabels).toBe(true);
  });

  test('Native switch support is feature-detected via \'switch\' in HTMLInputElement.prototype, and input-switch-polyfill is conditionally loaded only when native support is missing', () => {
    skipUnless({ unsupported: 'switch-control' });
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const binaryExprs = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );

    const featureCheckExpr = binaryExprs.find((expr) => {
      const op = expr.getOperatorToken().getText();
      if (op !== 'in') return false;
      const left = expr.getLeft().getText().replace(/['"`]/g, '').trim();
      const right = expr.getRight().getText().trim();
      return (
        left === 'switch' &&
        (right.includes('HTMLInputElement.prototype') || right.includes('HTMLInputElement'))
      );
    });

    const isConditionallyLoaded = Boolean(
      featureCheckExpr &&
        (() => {
          const allStrings = sourceFiles.flatMap((sf) => [
            ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
            ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
          ]);
          const polyfillNodes = allStrings.filter((s) =>
            s.getLiteralText().includes('input-switch-polyfill')
          );
          if (polyfillNodes.length === 0) return false;

          return polyfillNodes.some((node) => {
            let current: Node | undefined = node.getParent();
            while (current) {
              const kind = current.getKind();
              if (
                kind === SyntaxKind.IfStatement ||
                kind === SyntaxKind.ConditionalExpression ||
                kind === SyntaxKind.BinaryExpression
              ) {
                if (current.getDescendants().includes(featureCheckExpr)) {
                  return true;
                }
              }
              current = current.getParent();
            }
            return false;
          });
        })()
    );

    expect(isConditionallyLoaded).toBe(true);
  });

  test('The switch input sets a custom accent-color that applies to both native switch rendering and the polyfilled switch\'s active state', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = getSwitchInputs(docs);

    const hasRuleAccentColor = styleRules.some((rule) => {
      const sel = rule.selectorText || '';
      const val = rule.style.getPropertyValue('accent-color').trim();
      if (!val) return false;
      return (
        sel.includes('switch') ||
        sel.includes('checkbox') ||
        sel.includes('input') ||
        switchInputs.some(({ input }) => {
          const id = input.getAttribute('id');
          return id ? sel.includes(`#${id}`) : false;
        })
      );
    });

    const hasInlineOrUtilityAccent = switchInputs.some(({ input }) => {
      const inlineStyle = input.getAttribute('style') || '';
      const className = input.getAttribute('class') || '';
      return inlineStyle.includes('accent-color') || /\baccent-/.test(className);
    });

    expect(hasRuleAccentColor || hasInlineOrUtilityAccent).toBe(true);
  });

  test('Focusing the switch input via keyboard navigation (:focus-visible) displays a visible focus outline on the input itself', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = getSwitchInputs(docs);

    const hasFocusVisibleRule = styleRules.some((rule) => {
      const sel = rule.selectorText || '';
      if (!sel.includes(':focus-visible') && !sel.includes(':focus')) return false;
      const outline = rule.style.getPropertyValue('outline').trim();
      const outlineWidth = rule.style.getPropertyValue('outline-width').trim();
      const outlineStyle = rule.style.getPropertyValue('outline-style').trim();
      const outlineColor = rule.style.getPropertyValue('outline-color').trim();
      const hasVisibleOutline =
        (outline !== '' && outline !== 'none' && outline !== '0') ||
        (outlineWidth !== '' && outlineWidth !== '0' && outlineWidth !== '0px') ||
        (outlineStyle !== '' && outlineStyle !== 'none') ||
        outlineColor !== '';
      return hasVisibleOutline;
    });

    const hasUtilityFocusOutline = switchInputs.some(({ input }) => {
      const className = input.getAttribute('class') || '';
      return /\bfocus(-visible)?:(outline|ring)/.test(className);
    });

    expect(hasFocusVisibleRule || hasUtilityFocusOutline).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.route(
        (url) =>
          url.href.includes('cdn.jsdelivr.net/npm/input-switch-polyfill') &&
          url.pathname.endsWith('/index.js'),
        async (route) => {
          const fallbackUrl = route
            .request()
            .url()
            .replace(/\/index\.js$/, '/input-switch-polyfill.js');
          const response = await route.fetch({ url: fallbackUrl });
          await route.fulfill({ response });
        }
      );
      await page.goto(TARGET_URL);
    });

    test('When native switch support is missing, the checkbox input uses appearance: none to render switch styling while remaining visible and interactive', async ({ page }) => {
      skipUnless({ unsupported: 'switch-control' });
      const switchLocator = page.locator('input[type="checkbox"][switch]').first();
      await expect
        .poll(async () => {
          const count = await switchLocator.count();
          if (count === 0) return false;
          return switchLocator.evaluate((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const isAppearanceNone = style.appearance === 'none';
            const isVisible =
              rect.width > 4 &&
              rect.height > 4 &&
              style.opacity !== '0' &&
              style.visibility !== 'hidden' &&
              style.display !== 'none';
            const isInteractive = style.pointerEvents !== 'none';
            return isAppearanceNone && isVisible && isInteractive;
          });
        })
        .toBe(true);
    });

    test('Toggling the switch updates its checked state and visually updates the control\'s track styling between its unchecked and checked states', async ({ page }) => {
      const switchLocator = page.locator('input[type="checkbox"][switch]').first();
      const toggledAndStyled = await (async () => {
        for (let i = 0; i < 30; i++) {
          const count = await switchLocator.count();
          if (count > 0) {
            const ready = await switchLocator.evaluate(
              (el) =>
                'switch' in HTMLInputElement.prototype ||
                window.getComputedStyle(el).appearance === 'none'
            );
            if (ready) break;
          }
          await page.waitForTimeout(100);
        }
        if ((await switchLocator.count()) === 0) return false;

        const getVisualSignature = () =>
          switchLocator.evaluate((el) => {
            const s = window.getComputedStyle(el);
            const before = window.getComputedStyle(el, '::before');
            const after = window.getComputedStyle(el, '::after');
            return [
              s.backgroundColor,
              s.backgroundImage,
              s.borderColor,
              s.boxShadow,
              before.backgroundColor,
              before.transform,
              before.insetInlineStart,
              before.left,
              after.backgroundColor,
              after.transform,
              after.insetInlineStart,
              after.left,
            ].join('|');
          });

        const initialChecked = await switchLocator.isChecked();
        const beforeSig = await getVisualSignature();

        await switchLocator.click();

        const afterChecked = await switchLocator.isChecked();
        if (afterChecked === initialChecked) return false;

        for (let i = 0; i < 20; i++) {
          const afterSig = await getVisualSignature();
          if (afterSig !== beforeSig) return true;
          await page.waitForTimeout(50);
        }
        return false;
      })();

      expect(toggledAndStyled).toBe(true);
    });
  });
});
