import * as fs from 'fs';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind, type CallExpression, type PropertyAccessExpression } from 'ts-morph';
import {
  getCascadedStyle,
  CSSStyleRule,
  CSSSupportsRule,
  CSSGroupingRule,
  type CSSRule,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllCssRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectAllCssRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function getNormalizedHtmlDocuments(files: string[]): Array<{ file: string; document: any }> {
  const docs = getHtmlDocuments(files);
  for (const { document } of docs) {
    const allElements = Array.from(document.querySelectorAll('*')) as any[];
    for (const el of allElements) {
      if (typeof el.hasAttribute === 'function' && el.hasAttribute('class:list')) {
        const attrSummary = Array.from(el.attributes || [])
          .map((attr: any) => `${attr.name}=${attr.value}`)
          .join(' ');
        const hasSpaView = attrSummary.includes('spa-view');
        const hasInactive = attrSummary.includes('inactive');
        const hasAriaHidden = attrSummary.includes('aria-hidden');

        if (hasSpaView && hasInactive) {
          el.setAttribute('class', 'spa-view');
          if (hasAriaHidden && attrSummary.includes('false')) {
            el.setAttribute('aria-hidden', 'false');
          }
          if (el.parentNode) {
            const inactiveClone = el.cloneNode(true);
            inactiveClone.setAttribute('class', 'spa-view inactive');
            if (hasAriaHidden && attrSummary.includes('true')) {
              inactiveClone.setAttribute('aria-hidden', 'true');
            }
            el.parentNode.appendChild(inactiveClone);
          }
        } else if (hasSpaView) {
          el.setAttribute('class', 'spa-view');
        }
      }
    }
  }
  return docs;
}

function findInactiveViewElement(docs: Array<{ file: string; document: any }>): any {
  const selectors = [
    '.spa-view.inactive',
    '[role="tabpanel"].inactive',
    '.spa-view[aria-hidden="true"]',
    '[role="tabpanel"][aria-hidden="true"]',
    '[data-view].inactive',
    '.inactive[aria-hidden="true"]',
  ];
  for (const { document } of docs) {
    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found) return found;
    }
  }
  return undefined;
}

function findActiveViewElement(docs: Array<{ file: string; document: any }>): any {
  const selectors = [
    '.spa-view:not(.inactive)',
    '[role="tabpanel"]:not(.inactive):not([aria-hidden="true"])',
    '[data-view]:not(.inactive)',
  ];
  for (const { document } of docs) {
    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found) return found;
    }
  }
  return undefined;
}

test.describe('faster-spa-view-transitions Target Grader', () => {
  test('Basic presence: the modified source files contain content-visibility', () => {
    const hasContentVisibility = targetFiles.some(
      (f) =>
        fs.existsSync(f) &&
        (fs.readFileSync(f, 'utf8').includes('content-visibility') ||
          fs.readFileSync(f, 'utf8').includes('contentVisibility'))
    );
    expect(hasContentVisibility).toBe(true);
  });

  test('Inactive view elements have content-visibility: hidden applied', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );
    const docs = getNormalizedHtmlDocuments(targetFiles);
    const inactiveEl = findInactiveViewElement(docs);

    const hasCascadedHidden = inactiveEl
      ? getCascadedStyle(inactiveEl, topLevelStyleRules)
          .getPropertyValue('content-visibility')
          .trim() === 'hidden'
      : false;

    const hasInactiveStyleRule = topLevelStyleRules.some(
      (r) =>
        r.style.getPropertyValue('content-visibility').trim() === 'hidden' &&
        (r.selectorText.includes('inactive') ||
          r.selectorText.includes('hidden') ||
          r.selectorText.includes(':not('))
    );

    const hasUtilityClass = docs.some((d) =>
      Boolean(d.document.querySelector('[class*="content-visibility:hidden"]'))
    );

    expect(hasCascadedHidden || hasInactiveStyleRule || hasUtilityClass).toBe(true);
  });

  test('Active view element does not have content-visibility: hidden applied', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );
    const hasInactiveRule = topLevelStyleRules.some(
      (r) => r.style.getPropertyValue('content-visibility').trim() === 'hidden'
    );

    const docs = getNormalizedHtmlDocuments(targetFiles);
    const activeEl = findActiveViewElement(docs);

    let activeIsVisibleOrDefault = false;
    if (activeEl && hasInactiveRule) {
      const val = getCascadedStyle(activeEl, topLevelStyleRules)
        .getPropertyValue('content-visibility')
        .trim();
      activeIsVisibleOrDefault =
        val !== 'hidden' && (val === '' || val === 'visible' || val === 'auto');
    } else if (hasInactiveRule) {
      const baseViewRules = topLevelStyleRules.filter(
        (r) =>
          !r.selectorText.includes('inactive') &&
          !r.selectorText.includes('aria-hidden="true"') &&
          !r.selectorText.includes(':not(') &&
          (r.selectorText.includes('view') || r.selectorText.includes('panel'))
      );
      activeIsVisibleOrDefault = baseViewRules.every((r) => {
        const val = r.style.getPropertyValue('content-visibility').trim();
        return val !== 'hidden' && (val === '' || val === 'visible' || val === 'auto');
      });
    }

    expect(activeIsVisibleOrDefault).toBe(true);
  });

  test('Implementation toggles content-visibility state when switching between views', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    let hasClassToggle = false;
    let hasClassAdd = false;
    let hasClassRemove = false;
    let hasDirectStyleToggle = false;

    for (const call of callExpressions) {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expr as PropertyAccessExpression;
        const methodName = propAccess.getName();
        const receiverText = propAccess.getExpression().getText();
        const argsText = call.getArguments().map((a) => a.getText()).join(' ');

        if (receiverText.endsWith('classList')) {
          if (
            methodName === 'toggle' &&
            (argsText.includes('inactive') ||
              argsText.includes('active') ||
              argsText.includes('hidden'))
          ) {
            hasClassToggle = true;
          }
          if (
            methodName === 'add' &&
            (argsText.includes('inactive') ||
              argsText.includes('active') ||
              argsText.includes('hidden'))
          ) {
            hasClassAdd = true;
          }
          if (
            methodName === 'remove' &&
            (argsText.includes('inactive') ||
              argsText.includes('active') ||
              argsText.includes('hidden'))
          ) {
            hasClassRemove = true;
          }
        }

        if (methodName === 'setProperty' && argsText.includes('content-visibility')) {
          hasDirectStyleToggle = true;
        }
      }
    }

    const binaryExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.BinaryExpression));
    for (const bin of binaryExpressions) {
      if (bin.getLeft().getText().includes('contentVisibility')) {
        hasDirectStyleToggle = true;
      }
    }

    expect(hasClassToggle || (hasClassAdd && hasClassRemove) || hasDirectStyleToggle).toBe(true);
  });

  test('Inactive view elements use aria-hidden="true" to remove them from the accessibility tree', () => {
    const docs = getNormalizedHtmlDocuments(targetFiles);
    const inactiveEl = findInactiveViewElement(docs);
    const hasHtmlAriaHidden = Boolean(
      inactiveEl && inactiveEl.getAttribute('aria-hidden') === 'true'
    );

    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasJsAriaHidden = callExpressions.some((call: CallExpression) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      const propAccess = expr as PropertyAccessExpression;
      const args = call.getArguments();
      return (
        propAccess.getName() === 'setAttribute' &&
        args.length >= 2 &&
        args[0].getText().includes('aria-hidden')
      );
    });

    expect(hasHtmlAriaHidden || hasJsAriaHidden).toBe(true);
  });

  test('Focus is moved to the active view container upon transition', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const hasFocusCallOnView = callExpressions.some((call: CallExpression) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
      const propAccess = expr as PropertyAccessExpression;
      if (propAccess.getName() !== 'focus') return false;
      const receiverText = propAccess.getExpression().getText().trim();
      return !receiverText.startsWith('tabs[') && receiverText !== 'tab';
    });

    expect(hasFocusCallOnView).toBe(true);
  });

  test('Fallback applies display: none to inactive view elements when content-visibility is not supported', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(Array.from(stylesheet.cssRules));
    const supportsRules = allRules.filter(
      (r): r is CSSSupportsRule =>
        r instanceof CSSSupportsRule &&
        r.conditionText.toLowerCase().includes('not') &&
        r.conditionText.toLowerCase().includes('content-visibility')
    );

    const fallbackStyleRules = supportsRules.flatMap((sr) =>
      collectAllCssRules(Array.from(sr.cssRules)).filter(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule
      )
    );

    const docs = getNormalizedHtmlDocuments(targetFiles);
    const inactiveEl = findInactiveViewElement(docs);

    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );

    const hasCascadedFallbackDisplayNone =
      inactiveEl && fallbackStyleRules.length > 0
        ? getCascadedStyle(inactiveEl, [...topLevelStyleRules, ...fallbackStyleRules])
            .getPropertyValue('display')
            .trim() === 'none'
        : false;

    const hasFallbackRuleDisplayNone = fallbackStyleRules.some(
      (r) => r.style.getPropertyValue('display').trim() === 'none'
    );

    expect(hasCascadedFallbackDisplayNone || hasFallbackRuleDisplayNone).toBe(true);
  });
});
