import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import {
  CSSSupportsRule,
  CSSStyleRule,
  CSSGroupingRule,
  type CSSRule,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function findAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
      if ('cssRules' in rule && rule.cssRules) {
        result.push(...findAllStyleRules(Array.from(rule.cssRules)));
      }
    } else if (rule instanceof CSSGroupingRule) {
      result.push(...findAllStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function findSupportsRules(rules: Iterable<CSSRule>): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const r of rules) {
    if (r instanceof CSSSupportsRule) {
      result.push(r);
      result.push(...findSupportsRules(Array.from(r.cssRules)));
    } else if (r instanceof CSSGroupingRule) {
      result.push(...findSupportsRules(Array.from(r.cssRules)));
    }
  }
  return result;
}

test.describe('faster-spa-view-transitions Target Grader', () => {

  test('Inactive view elements must have content-visibility: hidden applied in styles', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = findAllStyleRules(Array.from(stylesheet.cssRules));
    const docs = getHtmlDocuments(targetFiles);

    const hasHiddenCv = styleRules.some(r => r.style.getPropertyValue('content-visibility')?.trim().toLowerCase() === 'hidden') ||
      docs.some(d => Boolean(d.document.querySelector('[class*="content-visibility-hidden"], [class*="cv-hidden"]')));

    expect(hasHiddenCv).toBe(true);
  });

  test('Active view element must not have content-visibility: hidden applied', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = findAllStyleRules(Array.from(stylesheet.cssRules));

    const hasVisibleOrScopedHidden = styleRules.some(r => r.style.getPropertyValue('content-visibility')?.trim().toLowerCase() === 'visible') ||
      (styleRules.some(r => r.style.getPropertyValue('content-visibility')?.trim().toLowerCase() === 'hidden') &&
       !styleRules.some(r => r.selectorText.trim() === '.spa-view' && r.style.getPropertyValue('content-visibility')?.trim().toLowerCase() === 'hidden'));

    expect(hasVisibleOrScopedHidden).toBe(true);
  });

  test('The implementation must toggle content-visibility / inactive state when switching between views', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasInactiveToggle = sourceFiles.some(sf => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some(call => {
        const exprText = call.getExpression().getText();
        const args = call.getArguments().map(a => a.getText().toLowerCase());
        const isClassListOp = exprText.includes('classList.add') ||
          exprText.includes('classList.remove') ||
          exprText.includes('classList.toggle');
        const isAttrOp = exprText.includes('setAttribute') ||
          exprText.includes('toggleAttribute');
        const hasTargetArg = args.some(arg =>
          arg.includes('inactive') ||
          arg.includes('content-visibility') ||
          arg.includes('spa-view') ||
          arg.includes('hidden')
        );
        return (isClassListOp || isAttrOp) && hasTargetArg;
      });
    });

    expect(hasInactiveToggle).toBe(true);
  });

  test('The implementation must use aria-hidden="true" on inactive view elements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAriaHiddenInMarkup = docs.some(d => Boolean(d.document.querySelector('[aria-hidden="true"], [aria-hidden*="true"]')));
    const hasAriaHiddenInJs = sourceFiles.some(sf => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some(call => {
        const exprText = call.getExpression().getText();
        const args = call.getArguments().map(a => a.getText().toLowerCase());
        return exprText.includes('setAttribute') && args.some(arg => arg.includes('aria-hidden'));
      });
    });

    expect(hasAriaHiddenInMarkup || hasAriaHiddenInJs).toBe(true);
  });

  test('The implementation should maintain focus management by moving focus to the active view container', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasFocusManagement = sourceFiles.some(sf => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some(call => {
        const exprText = call.getExpression().getText();
        return exprText.endsWith('.focus') || exprText === 'focus';
      });
    });

    expect(hasFocusManagement).toBe(true);
  });

  test('Fallback to display: none must be applied when content-visibility is not supported', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const supportsRules = findSupportsRules(Array.from(stylesheet.cssRules));

    const hasFallback = supportsRules.some(sr => {
      const cond = sr.conditionText.toLowerCase();
      const isNegatedCv = cond.includes('not') && cond.includes('content-visibility');
      if (!isNegatedCv) return false;
      const styleRules = findAllStyleRules(Array.from(sr.cssRules));
      return styleRules.some(r => r.style.getPropertyValue('display')?.trim().toLowerCase() === 'none');
    });

    expect(hasFallback).toBe(true);
  });

});
