import {
  test,
  expect,
  skipUnless,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  getCascadedStyle,
  closestRule,
  CSSStyleRule,
  CSSSupportsRule,
  CSSStyleDeclaration,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import { SyntaxKind, type Node, type Project } from 'ts-morph';
import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function isNegatedTextFitSupports(rule: CSSSupportsRule): boolean {
  const cond = rule.conditionText.toLowerCase();
  return cond.includes('not') && cond.includes('text-fit');
}

function getPrimaryStyleRules(stylesheet: CSSStyleSheet): CSSStyleRule[] {
  return getRules(stylesheet, CSSStyleRule).filter((rule) => {
    for (let curr = closestRule(rule, CSSSupportsRule); curr; curr = closestRule(curr, CSSSupportsRule)) {
      if (isNegatedTextFitSupports(curr)) return false;
    }
    return true;
  });
}

interface LockupTarget {
  rule: CSSStyleRule;
  element?: any;
}

function findLockupTargets(
  docs: Array<{ file: string; document: Document }>,
  primaryRules: CSSStyleRule[],
): LockupTarget[] {
  const textFitRules = primaryRules.filter(
    (r) => r.style.getPropertyValue('text-fit').trim() !== '',
  );
  return textFitRules.map((rule) => {
    let matchedEl: any;
    for (const { document } of docs) {
      try {
        const el = document.querySelector(rule.selectorText);
        if (el) {
          matchedEl = el;
          break;
        }
      } catch {
        // Ignore selectors unsupported by querySelector
      }
    }
    if (!matchedEl) {
      for (const { document } of docs) {
        const fallbackEl = document.querySelector('.lockup, .hero h1, h1');
        if (fallbackEl) {
          matchedEl = fallbackEl;
          break;
        }
      }
    }
    return { rule, element: matchedEl };
  });
}

function getLockupProperty(
  target: LockupTarget,
  primaryRules: CSSStyleRule[],
  prop: string,
): string {
  const direct = target.rule.style.getPropertyValue(prop).trim();
  if (direct) return direct;
  if (target.element) {
    const cascaded = getCascadedStyle(target.element, primaryRules)
      .getPropertyValue(prop)
      .trim();
    if (cascaded) return cascaded;
  }
  return '';
}

function isTightLineHeight(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith('%')) {
    const pct = Number.parseFloat(trimmed);
    return !Number.isNaN(pct) && pct > 0 && pct <= 100;
  }
  const num = Number.parseFloat(trimmed);
  return !Number.isNaN(num) && num > 0 && num <= 1;
}

function isDefiniteInlineSize(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  return (
    trimmed !== 'auto' &&
    trimmed !== 'fit-content' &&
    trimmed !== 'max-content' &&
    trimmed !== 'min-content' &&
    !trimmed.startsWith('fit-content(')
  );
}

function isLayoutWidthReadNode(node: Node): boolean {
  if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
    const name = node.asKind(SyntaxKind.PropertyAccessExpression)?.getName();
    return name === 'clientWidth' || name === 'offsetWidth' || name === 'scrollWidth';
  }
  if (node.getKind() === SyntaxKind.CallExpression) {
    const expr = node.asKind(SyntaxKind.CallExpression)?.getExpression();
    if (expr?.getKind() === SyntaxKind.PropertyAccessExpression) {
      return expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'getBoundingClientRect';
    }
  }
  return false;
}

function getInnermostIterationContainer(node: Node): Node | undefined {
  let current: Node | undefined = node.getParent();
  while (current) {
    const kind = current.getKind();
    if (
      kind === SyntaxKind.ForOfStatement ||
      kind === SyntaxKind.ForStatement ||
      kind === SyntaxKind.ForInStatement ||
      kind === SyntaxKind.WhileStatement ||
      kind === SyntaxKind.DoStatement
    ) {
      return current;
    }
    if (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression) {
      const parentCall = current.getParentIfKind(SyntaxKind.CallExpression);
      if (parentCall) {
        const expr = parentCall.getExpression();
        if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
          const methodName = expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName();
          if (methodName === 'forEach' || methodName === 'map') {
            return current;
          }
        }
      }
    }
    current = current.getParent();
  }
  return undefined;
}

test.describe('equal-width-text-lines Target Grader', () => {
  test('Stylesheets declare text-fit on the lockup heading with per-line-all, grow or shrink, a percentage guardrail, and a base font-size', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const primaryRules = getPrimaryStyleRules(stylesheet);
    const targets = findLockupTargets(docs, primaryRules);

    const hasValidTextFit = targets.some((target) => {
      const textFitValue = getLockupProperty(target, primaryRules, 'text-fit').toLowerCase();
      const tokens = textFitValue.split(/\s+/).filter(Boolean);
      const hasPerLineAll = tokens.includes('per-line-all') && !tokens.includes('per-line');
      const hasGrowXorShrink = tokens.includes('grow') !== tokens.includes('shrink');
      const hasPercentageGuardrail = tokens.some((token) => {
        if (!token.endsWith('%')) return false;
        const pct = Number.parseFloat(token);
        return !Number.isNaN(pct) && pct > 0;
      });
      const fontSize = getLockupProperty(target, primaryRules, 'font-size');
      return hasPerLineAll && hasGrowXorShrink && hasPercentageGuardrail && fontSize.length > 0;
    });

    expect(hasValidTextFit).toBe(true);
  });

  test('Lockup container has a definite inline size and lockup heading sets a tight line-height of 1 or less', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const primaryRules = getPrimaryStyleRules(stylesheet);
    const targets = findLockupTargets(docs, primaryRules);

    const hasDefiniteSizeAndTightLineHeight = targets.some((target) => {
      const width = getLockupProperty(target, primaryRules, 'width');
      const inlineSize = getLockupProperty(target, primaryRules, 'inline-size');
      const alignSelf = getLockupProperty(target, primaryRules, 'align-self');
      const hasDefiniteSize =
        isDefiniteInlineSize(width) ||
        isDefiniteInlineSize(inlineSize) ||
        alignSelf === 'stretch';

      const lineHeight = getLockupProperty(target, primaryRules, 'line-height');
      return hasDefiniteSize && isTightLineHeight(lineHeight);
    });

    expect(hasDefiniteSizeAndTightLineHeight).toBe(true);
  });

  test('Forced line span elements inside a lockup are styled with display: block and white-space: nowrap', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const primaryRules = getPrimaryStyleRules(stylesheet);
    const targets = findLockupTargets(docs, primaryRules);

    const hasValidForcedLineSpans = targets.some((target) => {
      const spans: any[] = target.element
        ? Array.from(target.element.querySelectorAll('span'))
        : [];
      if (spans.length === 0) return false;

      return spans.every((span) => {
        const cascaded = getCascadedStyle(span, primaryRules);
        const spanRules = primaryRules.filter((r) =>
          r.selectorText.toLowerCase().includes('span'),
        );
        const display =
          cascaded.getPropertyValue('display').trim() ||
          spanRules.map((r) => r.style.getPropertyValue('display').trim()).find(Boolean) ||
          '';
        const whiteSpace =
          cascaded.getPropertyValue('white-space').trim() ||
          cascaded.getPropertyValue('text-wrap').trim() ||
          cascaded.getPropertyValue('text-wrap-mode').trim() ||
          spanRules
            .map(
              (r) =>
                r.style.getPropertyValue('white-space').trim() ||
                r.style.getPropertyValue('text-wrap').trim(),
            )
            .find(Boolean) ||
          '';

        return display === 'block' && whiteSpace.includes('nowrap');
      });
    });

    expect(hasValidForcedLineSpans).toBe(true);
  });

  test('Lockup spaces forced line blocks with flex or grid gap and text-box trimming, or styles free lines with text-wrap balance or pretty without text-box', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const primaryRules = getPrimaryStyleRules(stylesheet);
    const targets = findLockupTargets(docs, primaryRules);

    const hasValidLockupSpacing = targets.some((target) => {
      const display = getLockupProperty(target, primaryRules, 'display').toLowerCase();
      const gap =
        getLockupProperty(target, primaryRules, 'gap') ||
        getLockupProperty(target, primaryRules, 'row-gap');
      const isFlexOrGridWithGap =
        (display === 'flex' ||
          display === 'inline-flex' ||
          display === 'grid' ||
          display === 'inline-grid') &&
        gap.length > 0 &&
        gap !== '0' &&
        gap !== '0px';

      const spans: any[] = target.element
        ? Array.from(target.element.querySelectorAll('span'))
        : [];
      const spanRules = primaryRules.filter((r) =>
        r.selectorText.toLowerCase().includes('span'),
      );

      const spansHaveTextBoxTrim =
        spans.length > 0 &&
        spans.every((span) => {
          const cascaded = getCascadedStyle(span, primaryRules);
          const combined = [
            cascaded.getPropertyValue('text-box'),
            cascaded.getPropertyValue('text-box-trim'),
            cascaded.getPropertyValue('text-box-edge'),
            ...spanRules.flatMap((r) => [
              r.style.getPropertyValue('text-box'),
              r.style.getPropertyValue('text-box-trim'),
              r.style.getPropertyValue('text-box-edge'),
            ]),
          ]
            .join(' ')
            .toLowerCase();

          return (
            combined.includes('trim-both') &&
            combined.includes('cap') &&
            combined.includes('alphabetic')
          );
        });

      if (isFlexOrGridWithGap && spansHaveTextBoxTrim) {
        return true;
      }

      const textWrap = (
        getLockupProperty(target, primaryRules, 'text-wrap') ||
        getLockupProperty(target, primaryRules, 'text-wrap-style')
      ).toLowerCase();
      const hasBalanceOrPretty =
        textWrap.includes('balance') || textWrap.includes('pretty');
      const hasAnyTextBox = primaryRules.some(
        (r) =>
          r.style.getPropertyValue('text-box').trim() !== '' ||
          r.style.getPropertyValue('text-box-trim').trim() !== '',
      );

      return hasBalanceOrPretty && !hasAnyTextBox;
    });

    expect(hasValidLockupSpacing).toBe(true);
  });

  test('Fallback @supports not (text-fit: ...) rule sets width: fit-content on forced lines and scales font-size with min() and a custom property capped at a percentage', () => {
    skipUnless({ unsupported: 'text-fit' });

    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const fallbackRules = getRules(stylesheet, CSSSupportsRule).filter(isNegatedTextFitSupports);
    const hasValidCssFallback = getRules(fallbackRules).some((rule: CSSRule) => {
      if (!('style' in rule && rule.style instanceof CSSStyleDeclaration)) return false;
      const width = (
        rule.style.getPropertyValue('width') || rule.style.getPropertyValue('inline-size')
      )
        .trim()
        .toLowerCase();
      const fontSize = rule.style.getPropertyValue('font-size').trim();
      const hasFitContent = width === 'fit-content';
      const hasMinWithCustomPropAndPct =
        fontSize.toLowerCase().includes('min(') &&
        fontSize.includes('var(--') &&
        fontSize.includes('%');

      return hasFitContent && hasMinWithCustomPropAndPct;
    });

    expect(hasValidCssFallback).toBe(true);
  });

  test('Fallback script checks CSS.supports for text-fit, observes lockups with ResizeObserver, resets the scale custom property, and batch-reads widths before writing custom property values', () => {
    skipUnless({ unsupported: 'text-fit' });

    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasValidJsFallback = sourceFiles.some((sf) => {
      const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const newExpressions = sf.getDescendantsOfKind(SyntaxKind.NewExpression);

      const hasSupportsCheck = callExpressions.some((call) => {
        const exprText = call.getExpression().getText();
        const isCssSupports =
          exprText === 'CSS.supports' || exprText.endsWith('.CSS.supports');
        const hasTextFitArg = call
          .getArguments()
          .some((arg) => arg.getText().toLowerCase().includes('text-fit'));
        return isCssSupports && hasTextFitArg;
      });

      const hasResizeObserverInstance = newExpressions.some((newExpr) =>
        newExpr.getExpression().getText().includes('ResizeObserver'),
      );
      const hasObserveCall = callExpressions.some((call) => {
        const expr = call.getExpression();
        return (
          expr.getKind() === SyntaxKind.PropertyAccessExpression &&
          expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'observe'
        );
      });

      const removePropertyCalls = callExpressions.filter((call) => {
        const expr = call.getExpression();
        if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
        const name = expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName();
        const firstArg = call.getArguments()[0]?.getText() ?? '';
        return name === 'removeProperty' && firstArg.includes('--');
      });

      const setPropertyCalls = callExpressions.filter((call) => {
        const expr = call.getExpression();
        if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
        const name = expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName();
        const firstArg = call.getArguments()[0]?.getText() ?? '';
        return name === 'setProperty' && firstArg.includes('--');
      });

      const widthReadNodes = sf
        .getDescendants()
        .filter((node) => isLayoutWidthReadNode(node));

      const hasOrderedBatchReadAndWrite = setPropertyCalls.some((writeCall) => {
        const writeStart = writeCall.getStart();
        const hasPriorResetAndRead = removePropertyCalls.some((resetCall) =>
          widthReadNodes.some(
            (readNode) =>
              resetCall.getStart() < readNode.getStart() &&
              readNode.getStart() < writeStart,
          ),
        );
        if (!hasPriorResetAndRead) return false;

        const writeLoop = getInnermostIterationContainer(writeCall) ?? writeCall;
        const readsInsideWriteLoop = writeLoop
          .getDescendants()
          .some((desc) => isLayoutWidthReadNode(desc));
        return !readsInsideWriteLoop;
      });

      return (
        hasSupportsCheck &&
        hasResizeObserverInstance &&
        hasObserveCall &&
        hasOrderedBatchReadAndWrite
      );
    });

    expect(hasValidJsFallback).toBe(true);
  });
});
