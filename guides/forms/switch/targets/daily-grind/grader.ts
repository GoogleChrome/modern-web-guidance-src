import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import { CSSStyleRule, getCascadedStyle } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(
  // @ts-ignore
  import.meta.url
);

test.describe('Switch Target Grader', () => {
  test('Each switch control is a standard HTML checkbox input with the switch attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = docs.flatMap(d => Array.from(d.document.querySelectorAll('input[type="checkbox"][switch]')));
    const allSwitchElements = docs.flatMap(d => Array.from(d.document.querySelectorAll('[switch]')));
    const validSwitchControls = switchInputs.length > 0 && switchInputs.length === allSwitchElements.length;
    expect(validSwitchControls).toBe(true);
  });

  test('Each switch input is associated with a label element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = docs.flatMap(d => Array.from(d.document.querySelectorAll('input[type="checkbox"][switch]')));
    const allAssociatedWithLabel = switchInputs.length > 0 && switchInputs.every((input: any) => {
      const isWrapped = Boolean(input.closest('label'));
      const id = input.getAttribute('id');
      const hasMatchingForLabel = Boolean(id && input.ownerDocument.querySelector(`label[for="${id}"]`));
      return isWrapped || hasMatchingForLabel;
    });
    expect(allAssociatedWithLabel).toBe(true);
  });

  test('Native switch support is feature-detected and input-switch-polyfill is conditionally loaded only when unsupported', () => {
    const project = getJsProject(targetFiles);
    const binaryExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );
    const hasFeatureDetection = binaryExpressions.some(expr => {
      const left = expr.getLeft().getText().replace(/['"`]/g, '');
      const op = expr.getOperatorToken().getText();
      const right = expr.getRight().getText();
      return left === 'switch' && op === 'in' && right === 'HTMLInputElement.prototype';
    });
    const hasUnconditionalImport = project.getSourceFiles().flatMap(sf => sf.getImportDeclarations()).some(decl =>
      decl.getModuleSpecifierValue().includes('input-switch-polyfill')
    );
    const callExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasConditionalPolyfillLoad = callExpressions.some(call => {
      const text = call.getText();
      if (!text.includes('input-switch-polyfill')) return false;
      return call.getAncestors().some(a =>
        a.getKind() === SyntaxKind.IfStatement ||
        a.getKind() === SyntaxKind.ConditionalExpression ||
        a.getKind() === SyntaxKind.BinaryExpression
      );
    });
    const featureDetectedAndConditionallyLoaded = hasFeatureDetection && hasConditionalPolyfillLoad && !hasUnconditionalImport;
    expect(featureDetectedAndConditionallyLoaded).toBe(true);
  });

  test('When native switch support is missing, the checkbox input uses appearance: none while remaining visible and interactive', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = docs.flatMap(d => Array.from(d.document.querySelectorAll('input[type="checkbox"][switch]')));
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const isNotHiddenOrClipped = switchInputs.length > 0 && switchInputs.every((input: any) => !input.hasAttribute('hidden')) && !rules.some(r =>
      r instanceof CSSStyleRule &&
      r.selectorText.includes('switch') &&
      (
        r.style.getPropertyValue('display') === 'none' ||
        r.style.getPropertyValue('visibility') === 'hidden' ||
        r.style.getPropertyValue('opacity') === '0' ||
        Boolean(r.style.getPropertyValue('clip')) ||
        r.style.getPropertyValue('clip-path') === 'inset(50%)'
      )
    );

    const hasAppearanceNoneRule = rules.some(r =>
      r instanceof CSSStyleRule &&
      r.selectorText.includes('switch') &&
      (r.style.getPropertyValue('appearance') === 'none' || r.style.getPropertyValue('-webkit-appearance') === 'none')
    );

    const project = getJsProject(targetFiles);
    const loadsSwitchPolyfill = project.getSourceFiles().some(sf => sf.getFullText().includes('input-switch-polyfill'));

    const usesAppearanceFallback = isNotHiddenOrClipped && (hasAppearanceNoneRule || loadsSwitchPolyfill);
    expect(usesAppearanceFallback).toBe(true);
  });

  test('Toggling the switch updates its checked state and visually updates the control track styling between unchecked and checked states', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = docs.flatMap(d => Array.from(d.document.querySelectorAll('input[type="checkbox"][switch]')));
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const hasCheckedTrackStyleRule = rules.some(r =>
      r instanceof CSSStyleRule &&
      r.selectorText.includes('switch') &&
      r.selectorText.includes(':checked') &&
      Boolean(
        r.style.getPropertyValue('background') ||
        r.style.getPropertyValue('background-color') ||
        r.style.getPropertyValue('accent-color')
      )
    );

    const project = getJsProject(targetFiles);
    const loadsSwitchPolyfillOrCheckedHandler = project.getSourceFiles().some(sf => {
      const text = sf.getFullText();
      return text.includes('input-switch-polyfill') || text.includes('.checked');
    });

    const updatesTrackStyling = switchInputs.length > 0 && (hasCheckedTrackStyleRule || loadsSwitchPolyfillOrCheckedHandler);
    expect(updatesTrackStyling).toBe(true);
  });

  test('The switch input sets a custom accent-color that applies to switch rendering', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = docs.flatMap(d => Array.from(d.document.querySelectorAll('input[type="checkbox"][switch]')));
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const hasAccentColorRule = rules.some(r =>
      r instanceof CSSStyleRule &&
      (r.selectorText.includes('switch') || r.selectorText.includes('checkbox')) &&
      Boolean(r.style.getPropertyValue('accent-color'))
    );

    const hasCascadedAccentColor = switchInputs.some((input: any) => {
      try {
        const cascaded = getCascadedStyle(input, rules);
        return Boolean(cascaded.getPropertyValue('accent-color'));
      } catch {
        return false;
      }
    });

    const hasUtilityAccent = docs.some(d =>
      Boolean(d.document.querySelector('input[switch][class*="accent-"], input[switch][style*="accent-color"]'))
    );

    const setsAccentColor = switchInputs.length > 0 && (hasAccentColorRule || hasCascadedAccentColor || hasUtilityAccent);
    expect(setsAccentColor).toBe(true);
  });

  test('Focusing the switch input via keyboard navigation displays a visible focus outline on the input', () => {
    const docs = getHtmlDocuments(targetFiles);
    const switchInputs = docs.flatMap(d => Array.from(d.document.querySelectorAll('input[type="checkbox"][switch]')));
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const hasFocusVisibleOutlineRule = rules.some(r =>
      r instanceof CSSStyleRule &&
      r.selectorText.includes(':focus-visible') &&
      (r.selectorText.includes('switch') || r.selectorText.includes('checkbox') || r.selectorText.includes('input')) &&
      Boolean(
        r.style.getPropertyValue('outline') ||
        r.style.getPropertyValue('outline-style') ||
        r.style.getPropertyValue('outline-color') ||
        r.style.getPropertyValue('outline-width')
      )
    );

    const hasUtilityFocusVisible = docs.some(d =>
      Boolean(d.document.querySelector('input[switch][class*="focus-visible:outline"], input[switch][class*="focus-visible:ring"]'))
    );

    const displaysFocusOutline = switchInputs.length > 0 && (hasFocusVisibleOutlineRule || hasUtilityFocusVisible);
    expect(displaysFocusOutline).toBe(true);
  });
});
