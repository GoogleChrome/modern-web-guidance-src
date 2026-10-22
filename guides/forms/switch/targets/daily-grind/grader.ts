import {
  test,
  expect,
  skipUnless,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project, type Node } from 'ts-morph';
import { CSSStyleRule, CSSGroupingRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';

// @ts-ignore - import.meta.url is supported in Playwright ESM runtime
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectStyleRules(rule.cssRules));
    }
  }
  return result;
}

function hasSwitchFeatureCheck(node: Node): boolean {
  const binaryExprs = [
    ...(node.getKind() === SyntaxKind.BinaryExpression ? [node.asKindOrThrow(SyntaxKind.BinaryExpression)] : []),
    ...node.getDescendantsOfKind(SyntaxKind.BinaryExpression),
  ];
  return binaryExprs.some((expr) => {
    if (expr.getOperatorToken().getText() !== 'in') return false;
    const left = expr.getLeft().getText().replace(/['"`]/g, '').trim();
    const right = expr.getRight().getText().trim();
    return left === 'switch' && right.includes('HTMLInputElement.prototype');
  });
}

function isPolyfillCall(callText: string, argText: string): boolean {
  return (callText === 'import' || callText === 'require') && argText.includes('input-switch-polyfill');
}

function hasPolyfillOrAppearanceFallback(): boolean {
  const project: Project = getJsProject(targetFiles);
  const sourceFiles = project.getSourceFiles();
  const hasPolyfillImport = sourceFiles.some(
    (sf) =>
      sf
        .getImportDeclarations()
        .some((d) => d.getModuleSpecifierValue().includes('input-switch-polyfill')) ||
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const exprText = call.getExpression().getText().trim();
        const firstArg = call.getArguments()[0]?.getText() || '';
        return isPolyfillCall(exprText, firstArg);
      })
  );

  const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
  const styleRules = collectStyleRules(stylesheet.cssRules);
  const hasAppearanceNone = styleRules.some((r) => {
    const appearance =
      r.style.getPropertyValue('appearance') || r.style.getPropertyValue('-webkit-appearance');
    return appearance.trim() === 'none';
  });

  return hasPolyfillImport || hasAppearanceNone;
}

test.describe('switch Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('Each switch control is a standard HTML <input type="checkbox"> element with the switch attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('[switch], [role="switch"]'))
    );
    const allValidCheckboxes =
      switchElements.length > 0 &&
      switchElements.every(
        (el: any) =>
          el.tagName?.toLowerCase() === 'input' &&
          (el.getAttribute('type') || '').toLowerCase() === 'checkbox' &&
          el.hasAttribute('switch')
      );
    expect(allValidCheckboxes).toBe(true);
  });

  test('Each switch input is associated with a <label> element via wrapping or matching for/id attributes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs: Array<{ doc: any; input: any }> = [];
    for (const d of docs) {
      const inputs = Array.from(d.document.querySelectorAll('input[type="checkbox"][switch]'));
      for (const input of inputs) {
        switchInputs.push({ doc: d.document, input });
      }
    }
    const allLabeled =
      switchInputs.length > 0 &&
      switchInputs.every(({ doc, input }) => {
        if (input.closest('label')) return true;
        const id = input.getAttribute('id');
        if (!id) return false;
        return Array.from(doc.querySelectorAll('label')).some(
          (label: any) => label.getAttribute('for') === id
        );
      });
    expect(allLabeled).toBe(true);
  });

  test('[unsupported: switch-control] Native switch support is feature-detected via switch in HTMLInputElement.prototype and input-switch-polyfill is conditionally loaded', () => {
    skipUnless({ unsupported: 'switch-control' });
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const unconditionalImports = sourceFiles.flatMap((sf) =>
      sf
        .getImportDeclarations()
        .filter((decl) => decl.getModuleSpecifierValue().includes('input-switch-polyfill'))
    );

    const polyfillCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
        const exprText = call.getExpression().getText().trim();
        const firstArg = call.getArguments()[0]?.getText() || '';
        return isPolyfillCall(exprText, firstArg);
      })
    );

    const allCallsGuarded =
      unconditionalImports.length === 0 &&
      polyfillCalls.length > 0 &&
      polyfillCalls.every((call) => {
        let current: Node | undefined = call.getParent();
        while (current) {
          if (current.getKind() === SyntaxKind.IfStatement) {
            const ifStmt = current.asKindOrThrow(SyntaxKind.IfStatement);
            if (hasSwitchFeatureCheck(ifStmt.getExpression())) return true;
          }
          if (current.getKind() === SyntaxKind.ConditionalExpression) {
            const condExpr = current.asKindOrThrow(SyntaxKind.ConditionalExpression);
            if (hasSwitchFeatureCheck(condExpr.getCondition())) return true;
          }
          if (current.getKind() === SyntaxKind.BinaryExpression) {
            const binExpr = current.asKindOrThrow(SyntaxKind.BinaryExpression);
            const op = binExpr.getOperatorToken().getText();
            if ((op === '&&' || op === '||') && hasSwitchFeatureCheck(binExpr.getLeft())) {
              return true;
            }
          }
          current = current.getParent();
        }
        return false;
      });

    expect(allCallsGuarded).toBe(true);
  });

  test('[supported: switch-control] The implementation relies on native <input type="checkbox" switch> without loading input-switch-polyfill or applying an appearance: none fallback', () => {
    skipUnless({ supported: 'switch-control' });
    const docs = getHtmlDocuments(targetFiles);
    const hasSwitchInput = docs.some((d) =>
      Boolean(d.document.querySelector('input[type="checkbox"][switch]'))
    );

    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasPolyfillImport = sourceFiles.some(
      (sf) =>
        sf
          .getImportDeclarations()
          .some((d) => d.getModuleSpecifierValue().includes('input-switch-polyfill')) ||
        sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
          const exprText = call.getExpression().getText().trim();
          const firstArg = call.getArguments()[0]?.getText() || '';
          return isPolyfillCall(exprText, firstArg);
        })
    );

    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const hasAppearanceNone = styleRules.some((r) => {
      const appearance =
        r.style.getPropertyValue('appearance') || r.style.getPropertyValue('-webkit-appearance');
      return appearance.trim() === 'none';
    });

    expect(hasSwitchInput && !hasPolyfillImport && !hasAppearanceNone).toBe(true);
  });

  test('The switch input sets a custom accent-color in CSS', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const hasAccentColor = styleRules.some((rule) => {
      const sel = rule.selectorText || '';
      const val = rule.style.getPropertyValue('accent-color').trim();
      const targetsSwitch =
        sel.includes('switch') || sel.includes('input') || sel.includes('checkbox') || sel === '[style]';
      return targetsSwitch && val.length > 0 && val !== 'auto' && val !== 'initial' && val !== 'unset';
    });
    expect(hasAccentColor).toBe(true);
  });

  test('Focusing the switch input via :focus-visible defines a visible focus outline on the input', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const hasFocusVisibleOutline = styleRules.some((rule) => {
      const sel = rule.selectorText || '';
      if (!sel.includes(':focus-visible')) return false;
      const outline = rule.style.getPropertyValue('outline').trim();
      const outlineWidth = rule.style.getPropertyValue('outline-width').trim();
      const outlineStyle = rule.style.getPropertyValue('outline-style').trim();
      const outlineColor = rule.style.getPropertyValue('outline-color').trim();
      const hasValidOutline =
        (outline.length > 0 && outline !== 'none' && outline !== '0') ||
        (outlineWidth.length > 0 && outlineWidth !== '0' && outlineWidth !== '0px' && outlineStyle !== 'none') ||
        (outlineColor.length > 0 && outlineStyle !== 'none');
      return hasValidOutline;
    });
    expect(hasFocusVisibleOutline).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('[unsupported: switch-control] When native switch support is missing, the checkbox input uses appearance: none while remaining visible and interactive', async ({
      page,
    }) => {
      skipUnless({ unsupported: 'switch-control' });
      const switchInput = page.locator('input[type="checkbox"][switch]').first();
      await expect
        .poll(async () => {
          return await switchInput.evaluate((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const isAppearanceNone = style.appearance === 'none';
            const isVisible =
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              parseFloat(style.opacity) > 0 &&
              rect.width > 10 &&
              rect.height > 10;
            const isInteractive = style.pointerEvents !== 'none' && !(el as HTMLInputElement).disabled;
            return isAppearanceNone && isVisible && isInteractive;
          });
        })
        .toBe(true);
    });

    test('Toggling the switch updates its checked state and visually updates the control between its unchecked and checked states', async ({
      page,
    }) => {
      const expectsFallback = hasPolyfillOrAppearanceFallback();
      const switchInput = page.locator('input[type="checkbox"][switch]').first();
      await expect
        .poll(async () => {
          return await switchInput.evaluate((el, needsAppearanceNone) => {
            if ('switch' in HTMLInputElement.prototype || !needsAppearanceNone) {
              return el.getBoundingClientRect().width > 0;
            }
            return window.getComputedStyle(el).appearance === 'none';
          }, expectsFallback);
        })
        .toBe(true);

      const getVisualState = async () => {
        return await switchInput.evaluate((el: HTMLInputElement) => {
          const s = window.getComputedStyle(el);
          const before = window.getComputedStyle(el, '::before');
          const after = window.getComputedStyle(el, '::after');
          return {
            checked: el.checked,
            visualSignature: [
              s.backgroundColor,
              s.backgroundImage,
              s.borderColor,
              s.color,
              s.boxShadow,
              before.backgroundColor,
              before.transform,
              before.insetInlineStart,
              before.left,
              before.marginInlineStart,
              after.backgroundColor,
              after.transform,
              after.insetInlineStart,
              after.left,
              after.marginInlineStart,
            ].join('|'),
          };
        });
      };

      const beforeToggle = await getVisualState();
      await switchInput.click({ force: true });
      if ((await switchInput.isChecked()) === beforeToggle.checked) {
        await switchInput.evaluate((el: HTMLInputElement) => el.click());
      }

      await expect
        .poll(async () => {
          const afterToggle = await getVisualState();
          const usesNativeSwitch = await switchInput.evaluate(
            (_el, needsAppearanceNone) =>
              'switch' in HTMLInputElement.prototype || !needsAppearanceNone,
            expectsFallback
          );
          return (
            afterToggle.checked !== beforeToggle.checked &&
            (afterToggle.visualSignature !== beforeToggle.visualSignature || usesNativeSwitch)
          );
        })
        .toBe(true);
    });

    test('The switch input applies a custom accent-color to native rendering and the polyfilled switch active state', async ({
      page,
    }) => {
      const expectsFallback = hasPolyfillOrAppearanceFallback();
      const switchInput = page.locator('input[type="checkbox"][switch]').first();
      await expect
        .poll(async () => {
          return await switchInput.evaluate((el, needsAppearanceNone) => {
            if ('switch' in HTMLInputElement.prototype || !needsAppearanceNone) {
              return el.getBoundingClientRect().width > 0;
            }
            return window.getComputedStyle(el).appearance === 'none';
          }, expectsFallback);
        })
        .toBe(true);

      const uncheckedBg = await switchInput.evaluate((el: HTMLInputElement) => {
        if (el.checked) el.click();
        return window.getComputedStyle(el).backgroundColor;
      });

      await switchInput.evaluate((el: HTMLInputElement) => {
        if (!el.checked) el.click();
      });

      await expect
        .poll(async () => {
          return await switchInput.evaluate(
            (el: HTMLInputElement, { inactiveBg, needsAppearanceNone }) => {
              const style = window.getComputedStyle(el);
              const before = window.getComputedStyle(el, '::before');
              const after = window.getComputedStyle(el, '::after');
              const accentColor = style.accentColor;
              const hasCustomAccent = Boolean(accentColor && accentColor !== 'auto');
              if ('switch' in HTMLInputElement.prototype || !needsAppearanceNone) {
                return hasCustomAccent;
              }
              const hasPolyfillSync =
                el.hasAttribute('role') ||
                el.getAttribute('style')?.includes('color') ||
                style.backgroundColor !== inactiveBg ||
                style.backgroundImage !== 'none' ||
                before.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                after.backgroundColor !== 'rgba(0, 0, 0, 0)';
              return hasCustomAccent && hasPolyfillSync;
            },
            { inactiveBg: uncheckedBg, needsAppearanceNone: expectsFallback }
          );
        })
        .toBe(true);
    });

    test('Focusing the switch input via keyboard navigation (:focus-visible) displays a visible focus outline on the input itself', async ({
      page,
    }) => {
      const switchInput = page.locator('input[type="checkbox"][switch]').first();
      await page.keyboard.press('Tab');
      await switchInput.focus();

      const hasVisibleOutline = await switchInput.evaluate((el) => {
        const matchesFocusVisible = el.matches(':focus-visible');
        const style = window.getComputedStyle(el);
        const outlineStyle = style.outlineStyle;
        const outlineWidth = parseFloat(style.outlineWidth);
        return matchesFocusVisible && outlineStyle !== 'none' && outlineWidth > 0;
      });

      expect(hasVisibleOutline).toBe(true);
    });
  });
});
