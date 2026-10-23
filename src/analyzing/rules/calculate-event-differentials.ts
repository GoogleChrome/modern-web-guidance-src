import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const CALCULATE_EVENT_DIFFERENTIALS_GUIDE_HASH = '77481d042afa';

const TEMPORAL_GUARD_TOKENS = ['Temporal', '@js-temporal/polyfill'] as const;

// Case-sensitive allowlist: days, weeks, months, years, quarters. Rejects 'm' (minutes) and 'D' (milliseconds).
const CALENDAR_DIFF_UNIT_REGEX = /^(day|days|d|week|weeks|w|month|months|M|year|years|y|quarter|quarters)$/;

/**
 * Evaluates the divisor of a division to check if it equals 86400000:
 * - 86400000
 * - 864e5
 * - 1000 * 60 * 60 * 24
 */
function evaluateDivisor(node: Node): number | null {
  const unwrapped = unwrapExpression(node);
  if (Node.isNumericLiteral(unwrapped)) {
    return unwrapped.getLiteralValue();
  }
  if (Node.isBinaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken().getKind();
    if (op === SyntaxKind.AsteriskToken) {
      const leftVal = evaluateDivisor(unwrapped.getLeft());
      const rightVal = evaluateDivisor(unwrapped.getRight());
      if (leftVal !== null && rightVal !== null) {
        return leftVal * rightVal;
      }
    }
  }
  return null;
}

/**
 * Checks whether an operand represents "now" (e.g. Date.now() or zero-argument new Date()).
 */
function isDateNow(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();
  if (text.includes('Date.now()')) {
    return true;
  }
  if (Node.isNewExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (expr.getText() === 'Date' && unwrapped.getArguments().length === 0) {
      return true;
    }
  }
  if (Node.isCallExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName();
      if (name === 'getTime' || name === 'valueOf') {
        const caller = unwrapExpression(expr.getExpression());
        if (Node.isNewExpression(caller) && caller.getArguments().length === 0) {
          return true;
        }
      }
    }
  }
  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.PlusToken
  ) {
    return isDateNow(unwrapped.getOperand());
  }
  return false;
}

/**
 * Checks whether an operand explicitly calls .getTime() or new Date(...) on a known Date instance,
 * excluding Date.UTC, Date.now(), or custom classes (like LocalDate).
 */
function isGetTimeOrNewDate(node: Node): boolean {
  if (isDateNow(node)) {
    return false;
  }

  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();

  if (text.includes('Date.UTC')) {
    return false;
  }

  if (Node.isCallExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(expr) && (expr.getName() === 'getTime' || expr.getName() === 'valueOf')) {
      const caller = unwrapExpression(expr.getExpression());
      const callerText = caller.getText();
      // Ensure not Date.now() or non-date
      if (!callerText.includes('now') && !callerText.includes('UTC')) {
        return true;
      }
    }
  }

  if (Node.isNewExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    // Only standard global Date, not LocalDate or DateRange
    if (expr.getText() === 'Date' || expr.getText() === 'window.Date' || expr.getText() === 'globalThis.Date') {
      return true;
    }
  }

  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.PlusToken
  ) {
    return isGetTimeOrNewDate(unwrapped.getOperand());
  }

  return false;
}

/**
 * Unwraps Math.abs(...) around a subtraction expression.
 */
function unwrapSubtraction(node: Node): BinaryExpression | null {
  const unwrapped = unwrapExpression(node);
  if (Node.isBinaryExpression(unwrapped) && unwrapped.getOperatorToken().getKind() === SyntaxKind.MinusToken) {
    return unwrapped;
  }
  if (Node.isCallExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'abs') {
      const caller = unwrapExpression(expr.getExpression());
      if (caller.getText() === 'Math') {
        const args = unwrapped.getArguments();
        if (args.length > 0) {
          return unwrapSubtraction(args[0]);
        }
      }
    }
  }
  return null;
}

/**
 * Checks whether the division result is rounded with Math.round (which is already DST-correct).
 */
function isEnclosingMathRound(binExpr: BinaryExpression): boolean {
  let parent: Node | undefined = binExpr.getParent();
  while (parent && Node.isParenthesizedExpression(parent)) {
    parent = parent.getParent();
  }
  if (parent && Node.isCallExpression(parent)) {
    const expr = unwrapExpression(parent.getExpression());
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'round') {
      const caller = unwrapExpression(expr.getExpression());
      if (caller.getText() === 'Math') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks division expressions dividing date differences by 86400000:
 * (a.getTime() - b.getTime()) / 86400000
 * where BOTH sides explicitly call .getTime() or new Date(...), never Date.now().
 */
function matchDayDivisionDifferential(binExpr: BinaryExpression): AnalyzerMatch | null {
  if (binExpr.getOperatorToken().getKind() !== SyntaxKind.SlashToken) {
    return null;
  }

  if (isProtectedByFeatureGuard(binExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  if (isEnclosingMathRound(binExpr)) {
    return null;
  }

  const divisorVal = evaluateDivisor(binExpr.getRight());
  if (divisorVal !== 86400000 && divisorVal !== 864e5) {
    return null;
  }

  const subExpr = unwrapSubtraction(binExpr.getLeft());
  if (!subExpr) {
    return null;
  }

  const subLeft = subExpr.getLeft();
  const subRight = subExpr.getRight();

  if (isGetTimeOrNewDate(subLeft) && isGetTimeOrNewDate(subRight)) {
    return {
      line: binExpr.getStartLineNumber(),
      message:
        'Legacy millisecond day difference arithmetic ((a.getTime() - b.getTime()) / 86400000) used instead of Temporal.Duration or Temporal.PlainDate.since()/.until().',
    };
  }

  return null;
}

/**
 * Checks calls to moment(...).diff(other, calendarUnit) or dayjs(...).diff(other, calendarUnit)
 * with an explicit calendar unit argument (days, weeks, months, years).
 */
function matchMomentDiffCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  if (expr.getName() !== 'diff') {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 2) {
    return null;
  }

  const unitArg = unwrapExpression(args[1]);
  if (!Node.isStringLiteral(unitArg) && !Node.isNoSubstitutionTemplateLiteral(unitArg)) {
    return null;
  }

  const unitText = unitArg.getLiteralText();
  if (!CALENDAR_DIFF_UNIT_REGEX.test(unitText)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      `Legacy date library .diff(other, '${unitText}') used to calculate calendar differentials instead of Temporal.Duration or Temporal.PlainDate/ZonedDateTime.since()/.until().`,
  };
}

export const calculateEventDifferentialsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['86400000', '864e5', '3600000', '36e5', '.diff(', 'differenceIn', 'getTime'],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binExpr of binaryExpressions) {
      const divMatch = matchDayDivisionDifferential(binExpr);
      if (divMatch) {
        matches.push(divMatch);
      }
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchMomentDiffCall(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const calculateEventDifferentialsRule: AnalyzerRule = {
  id: 'calculate-event-differentials',
  guideId: 'calculate-event-differentials',
  guideHash: CALCULATE_EVENT_DIFFERENTIALS_GUIDE_HASH,
  summary:
    'Flag legacy arithmetic date differential math ((a.getTime() - b.getTime()) / 86400000) or moment.diff() / dayjs.diff() with calendar units instead of Temporal.Duration or Temporal.PlainDate/ZonedDateTime.',
  matcher: calculateEventDifferentialsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Dividing the difference between two Date instances ((a.getTime() - b.getTime()) / 86400000) to compute elapsed days instead of Temporal.Duration or Temporal.PlainDate.since()/.until().',
      'Calling moment(...).diff(..., calendarUnit) or dayjs(...).diff(..., calendarUnit) with days, weeks, months, or years instead of Temporal.',
    ],
    dropWhen: [
      'Runtime elapsed-time or cache TTL timers measuring Date.now() - timestamp.',
      'Intra-day millisecond or second divisions (such as / 1000, / 60, / 3600000 for seconds, minutes, or hours).',
      'Code already protected by feature detection for native Temporal support.',
      'Calculations using Math.round() or Date.UTC timestamps where DST day length variation does not cause off-by-one errors.',
    ],
  },
};

/**
 * Opt-in only until re-measured: retired from default production scan per Slice 5 audit.
 */
export const calculateEventDifferentialsRules: readonly AnalyzerRule[] = [
  calculateEventDifferentialsRule,
];
