import { Node, SyntaxKind, type CallExpression, type ForInStatement, type ForOfStatement, type ForStatement, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const STACK_DRILL_DOWN_GUIDE_HASH = 'c3b9a4677d1b';

const INERT_GUARD_TOKENS = ['inert', 'HTMLElement.prototype'] as const;

const TABINDEX_NEG_REGEX =
  /(tabIndex\s*=\s*['"]?-1['"]?|setAttribute\s*\(\s*['"]tabindex['"]\s*,\s*['"]?-1['"]?\s*\)|\.attr\s*\(\s*['"]tabindex['"]\s*,\s*['"]?-1['"]?\s*\))/i;

const ARIA_HIDDEN_TRUE_REGEX =
  /(ariaHidden\s*=\s*(true|['"]true['"])|setAttribute\s*\(\s*['"]aria-hidden['"]\s*,\s*['"]true['"]\s*\)|\.attr\s*\(\s*['"]aria-hidden['"]\s*,\s*['"]true['"]\s*\))/i;

const DECORATIVE_GRAPHICS_REGEX =
  /\b(svg|canvas|cvs|icon|img|glyph|badge|avatar|spinner)\b/i;

/**
 * Checks whether loop body sets tabIndex = -1 or aria-hidden = "true" on background elements.
 */
function loopDisablesBackground(loopNode: Node, body: Node): boolean {
  const bodyText = body.getText();
  const loopText = loopNode.getText();

  const hasTabIndexNeg = TABINDEX_NEG_REGEX.test(bodyText);
  const hasAriaHiddenTrue = ARIA_HIDDEN_TRUE_REGEX.test(bodyText);

  if (!hasTabIndexNeg && !hasAriaHiddenTrue) {
    return false;
  }

  // If only aria-hidden is set without tabindex, exclude decorative graphic loops (svg, canvas, icons)
  if (!hasTabIndexNeg && hasAriaHiddenTrue) {
    if (DECORATIVE_GRAPHICS_REGEX.test(loopText)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether the loop is a roving tabindex widget (e.g. tabs in a tablist)
 * rather than background / view disabling.
 */
function isRovingTabindexWidget(loopText: string): boolean {
  // If aria-hidden="true" is set, it is view/background disabling, not roving tabindex
  if (ARIA_HIDDEN_TRUE_REGEX.test(loopText)) {
    return false;
  }
  // If it mentions tablist / role="tab" / roving and doesn't mention view, background, modal, drawer, stack, pane
  const lower = loopText.toLowerCase();
  if (
    (lower.includes('tablist') || lower.includes('[role="tab"]') || lower.includes("role='tab'")) &&
    !lower.includes('view') &&
    !lower.includes('panel') &&
    !lower.includes('modal') &&
    !lower.includes('drawer') &&
    !lower.includes('backdrop') &&
    !lower.includes('background') &&
    !lower.includes('stack')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks forEach or each call expressions iterating over elements.
 */
function matchForEachLoop(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (methodName !== 'forEach' && methodName !== 'each') {
    return null;
  }

  const args = callExpr.getArguments();
  const callback = args.length >= 1 ? unwrapExpression(args[0]) : null;
  if (!callback || (!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback))) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, INERT_GUARD_TOKENS)) {
    return null;
  }

  const loopText = callExpr.getText();
  if (isRovingTabindexWidget(loopText)) {
    return null;
  }

  if (loopDisablesBackground(callExpr, callback)) {
    return {
      line: callExpr.getStartLineNumber(),
      message:
        'Imperative background-disabling / focus-trapping loop setting tabIndex="-1" or aria-hidden="true" used instead of HTML inert attribute',
    };
  }

  return null;
}

/**
 * Checks for / for..of / for..in statements iterating over elements.
 */
function matchStandardLoop(
  stmt: ForStatement | ForOfStatement | ForInStatement,
): AnalyzerMatch | null {
  if (isProtectedByFeatureGuard(stmt, INERT_GUARD_TOKENS)) {
    return null;
  }

  const loopText = stmt.getText();
  if (isRovingTabindexWidget(loopText)) {
    return null;
  }

  const body = stmt.getStatement();
  if (loopDisablesBackground(stmt, body)) {
    return {
      line: stmt.getStartLineNumber(),
      message:
        'Imperative background-disabling / focus-trapping loop setting tabIndex="-1" or aria-hidden="true" used instead of HTML inert attribute',
    };
  }

  return null;
}

export const stackDrillDownMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['tabIndex', 'tabindex', 'aria-hidden', 'ariaHidden', 'inert'],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchForEachLoop(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    const forStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement);
    for (const stmt of forStatements) {
      const match = matchStandardLoop(stmt);
      if (match) {
        matches.push(match);
      }
    }

    const forOfStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ForOfStatement);
    for (const stmt of forOfStatements) {
      const match = matchStandardLoop(stmt);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const stackDrillDownRule: AnalyzerRule = {
  id: 'stack-drill-down',
  guideId: 'stack-drill-down',
  guideHash: STACK_DRILL_DOWN_GUIDE_HASH,
  summary:
    'Flag imperative background-disabling and focus-trapping loops iterating over background or sibling elements to set tabIndex = -1 or aria-hidden = "true" on inactive views/panels instead of toggling the HTML inert attribute.',
  matcher: stackDrillDownMatcher,
  phase2Rubric: {
    keepWhen: [
      'Iterating over background views, sibling containers, or modal backdrop elements via querySelectorAll, forEach, or loops to set tabIndex = -1 or aria-hidden = "true" to trap focus or deactivate off-screen layers.',
      'Focus trapping and background suppression helpers that toggle tabindex="-1" and aria-hidden="true" across multi-view stacks or drawers instead of element.inert = true.',
    ],
    dropWhen: [
      'Single-element tabIndex adjustments (e.g. element.tabIndex = -1 on a single heading, file input, or container).',
      'Roving tabIndex navigation within a single composite widget (e.g. moving between items in a tablist, menu, or toolbar).',
      'Code guarded by feature detection for the inert attribute (e.g. "inert" in HTMLElement.prototype).',
      'Polyfills or test suites for the inert attribute itself.',
    ],
  },
};
