import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { pathToFileURL } from 'url';
import * as path from 'path';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import { CSSStyleRule, CSSSupportsRule, type CSSStyleSheet } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(pathToFileURL(path.resolve('grader.ts')).href);

test.describe('faster-spa-view-transitions Target Grader', () => {
  // Requirement 1: Inactive view elements must have content-visibility: hidden applied in their computed styles.
  test('inactive view elements have content-visibility: hidden applied in styles', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const styleRules = rules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const hasInactiveHidden = styleRules.some((r) => {
      const hasHidden = r.style.getPropertyValue('content-visibility') === 'hidden';
      const targetsInactive =
        /\b(inactive|hidden)\b/i.test(r.selectorText) || /aria-hidden/i.test(r.selectorText);
      return hasHidden && targetsInactive;
    });
    expect(hasInactiveHidden).toBe(true);
  });

  // Requirement 2: The active view element must not have content-visibility: hidden applied (it should be visible or default).
  test('active view elements are defined and do not apply content-visibility: hidden', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const styleRules = rules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const viewContainersExist = docs.some((d) =>
      Boolean(d.document.querySelector('.spa-view, [class*="spa-view"], [data-view]'))
    );
    const baseRulesDontHide = !styleRules.some((r) => {
      const sel = r.selectorText;
      const isBaseViewRule =
        /\bspa-view\b/.test(sel) && !/\binactive\b|\bhidden\b|aria-hidden/.test(sel);
      return isBaseViewRule && r.style.getPropertyValue('content-visibility') === 'hidden';
    });

    expect(viewContainersExist && baseRulesDontHide).toBe(true);
  });

  // Requirement 3: The implementation must toggle the content-visibility state when switching between views.
  test('view switching logic toggles inactive state or content-visibility on view containers', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const stringLiterals = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    );
    const hasInactiveOrViewReference = stringLiterals.some((str) => {
      const val = str.getLiteralValue();
      return val === 'inactive' || val === 'spa-view' || val === 'hidden';
    });

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasClassOrStyleMutation = callExpressions.some((call) => {
      const text = call.getText();
      return (
        /classList\.(add|toggle|remove)/.test(text) ||
        /setAttribute\(\s*['"`](class|aria-hidden|style)['"`]/i.test(text)
      );
    });

    expect(sourceFiles.length > 0 && hasInactiveOrViewReference && hasClassOrStyleMutation).toBe(
      true
    );
  });

  // Requirement 4: The implementation must use aria-hidden="true" on inactive view elements to ensure they are removed from the accessibility tree.
  test('inactive view elements use aria-hidden="true" to remove from accessibility tree', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const stringLiterals = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    );
    const hasAriaHiddenInJs = stringLiterals.some((str) => str.getLiteralValue() === 'aria-hidden');
    const hasAriaHiddenInHtml = docs.some((d) => Boolean(d.document.querySelector('[aria-hidden]')));

    expect(hasAriaHiddenInJs || hasAriaHiddenInHtml).toBe(true);
  });

  // Requirement 5: The implementation should maintain focus management by moving focus to the active view container upon transition.
  test('focus management moves focus to active view container upon navigation', () => {
    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExpressions = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasFocusCall = callExpressions.some((call) => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        return expr.getText().endsWith('.focus');
      }
      return false;
    });

    expect(sourceFiles.length > 0 && hasFocusCall).toBe(true);
  });

  // Requirement 6: If content-visibility is not supported, inactive view elements must have display: none applied in their computed styles.
  test('fallback provides display: none for browsers without content-visibility support', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const supportsRules = rules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);

    const hasFallbackRule = supportsRules.some((r) => {
      const cond = r.conditionText;
      const isNegation = cond.includes('not') && cond.includes('content-visibility');
      const hasDisplayNone = Array.from(r.cssRules).some(
        (nr) => nr instanceof CSSStyleRule && nr.style.getPropertyValue('display') === 'none'
      );
      return isNegation && hasDisplayNone;
    });

    expect(hasFallbackRule).toBe(true);
  });
});
