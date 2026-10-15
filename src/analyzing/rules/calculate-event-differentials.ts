import { Node, SyntaxKind, type BinaryExpression, type CallExpression, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, resolveLocalExpression, unwrapExpression } from '../scanners/ast-helpers.ts';

export const CALCULATE_EVENT_DIFFERENTIALS_GUIDE_HASH = 'ee7112b330c4';

const TEMPORAL_GUARD_TOKENS = ['Temporal', '@js-temporal/polyfill'] as const;

const CALENDAR_UNIT_REGEX = /^['"](years?|months?|weeks?|days?|hours?|minutes?|seconds?)['"]$/i;

const DATE_TIME_IDENTIFIERS_REGEX =
  /(date|time|start|end|created|updated|expires|expire|timestamp|deadline|since|until|last|prev|curr|event)/i;

const BENCHMARK_IDENTIFIER_REGEX =
  /(bench|perf|benchmark|t0|t1|start_?time_?bench|perf_?now)/i;

/**
 * Evaluates the divisor of a division to check if it equals a known calendar constant:
 * - 86400000 (1 day in ms)
 * - 3600000 (1 hour in ms)
 * - 60000 (1 minute in ms)
 * - 86400 (1 day in sec)
 * - 3600 (1 hour in sec)
 * - 60 (1 minute in sec)
 * - 1000 (seconds from ms)
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
 * Checks whether an expression represents a Date/timestamp operand.
 */
function isDateOperand(node: Node): boolean {
  const resolved = resolveLocalExpression(node);
  const text = resolved.getText();

  if (text.includes('performance.now()') || BENCHMARK_IDENTIFIER_REGEX.test(text)) {
    return false;
  }

  return (
    text.includes('.getTime()') ||
    text.includes('Date.now()') ||
    text.includes('Date.parse(') ||
    text.includes('.valueOf()') ||
    text.includes('new Date(')
  );
}

/**
 * Checks whether the dividend expression represents a subtraction of two dates or timestamps.
 */
function isDateDifferenceExpression(node: Node): boolean {
  const resolved = resolveLocalExpression(node);
  const text = resolved.getText();

  // Exclude performance.now() and benchmark timers
  if (text.includes('performance.now()') || BENCHMARK_IDENTIFIER_REGEX.test(text)) {
    return false;
  }

  // Check if expression is a subtraction (-)
  const subtractions = resolved.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  const hasMinus =
    (Node.isBinaryExpression(resolved) && resolved.getOperatorToken().getKind() === SyntaxKind.MinusToken) ||
    subtractions.some((b) => b.getOperatorToken().getKind() === SyntaxKind.MinusToken);

  if (!hasMinus) {
    return false;
  }

  // Must involve dates, timestamps, or date/time identifiers
  if (
    text.includes('.getTime()') ||
    text.includes('Date.now()') ||
    text.includes('Date.parse(') ||
    text.includes('.valueOf()') ||
    text.includes('new Date(') ||
    DATE_TIME_IDENTIFIERS_REGEX.test(text)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks division expressions dividing date differences by calendar unit constants.
 */
function matchDivisionDifferential(binExpr: BinaryExpression): AnalyzerMatch | null {
  if (binExpr.getOperatorToken().getKind() !== SyntaxKind.SlashToken) {
    return null;
  }

  if (isProtectedByFeatureGuard(binExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  const divisorVal = evaluateDivisor(binExpr.getRight());
  if (divisorVal === null) {
    return null;
  }

  // Calendar unit divisors (in ms or seconds)
  const isCalendarDivisor =
    divisorVal === 86400000 ||
    divisorVal === 864e5 ||
    divisorVal === 3600000 ||
    divisorVal === 36e5 ||
    divisorVal === 60000 ||
    divisorVal === 6e4 ||
    divisorVal === 86400 ||
    divisorVal === 3600 ||
    divisorVal === 60 ||
    divisorVal === 1000;

  if (!isCalendarDivisor) {
    return null;
  }

  if (isDateDifferenceExpression(binExpr.getLeft())) {
    return {
      line: binExpr.getStartLineNumber(),
      message: `Legacy arithmetic date differential math (/ ${divisorVal}) used instead of Temporal.Duration or Temporal.ZonedDateTime.since()/.until().`,
    };
  }

  return null;
}

/**
 * Checks direct Date timestamp subtractions:
 * a.getTime() - b.getTime(), Date.now() - a.getTime(), new Date(a) - new Date(b), Date.parse(a) - Date.parse(b), etc.
 */
function matchDirectDateSubtraction(binExpr: BinaryExpression): AnalyzerMatch | null {
  if (binExpr.getOperatorToken().getKind() !== SyntaxKind.MinusToken) {
    return null;
  }

  if (isProtectedByFeatureGuard(binExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  // Skip if this subtraction is already the dividend of an enclosing division
  let parent: Node | undefined = binExpr.getParent();
  while (parent && (Node.isParenthesizedExpression(parent) || Node.isAsExpression(parent))) {
    parent = parent.getParent();
  }
  if (parent && Node.isBinaryExpression(parent) && parent.getOperatorToken().getKind() === SyntaxKind.SlashToken) {
    return null;
  }

  const text = binExpr.getText();
  if (text.includes('performance.now()') || BENCHMARK_IDENTIFIER_REGEX.test(text)) {
    return null;
  }

  const left = binExpr.getLeft();
  const right = binExpr.getRight();

  const leftIsDate = isDateOperand(left);
  const rightIsDate = isDateOperand(right);

  if (leftIsDate || rightIsDate) {
    return {
      line: binExpr.getStartLineNumber(),
      message:
        'Direct Date timestamp subtraction used to compute elapsed/remaining time instead of Temporal.Duration or Temporal.Instant/ZonedDateTime.since()/.until().',
    };
  }

  return null;
}

/**
 * Checks calls to moment(...).diff(...) or dayjs(...).diff(...) with time units.
 */
function matchMomentDiffCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (!methodName || methodName !== 'diff') {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  const callerText = expr.getExpression().getText();
  const args = callExpr.getArguments();

  // If caller is explicitly moment(...) or dayjs(...)
  if (
    callerText.includes('moment(') ||
    callerText.includes('dayjs(') ||
    callerText.startsWith('moment') ||
    callerText.startsWith('dayjs')
  ) {
    return {
      line: callExpr.getStartLineNumber(),
      message:
        'Legacy moment.diff() used to calculate date/time differentials instead of Temporal.Duration or Temporal.ZonedDateTime.since()/.until().',
    };
  }

  // Or if 2nd argument is a calendar unit string like 'days', 'hours'
  if (args.length >= 2) {
    const unitArg = unwrapExpression(args[1]).getText();
    if (CALENDAR_UNIT_REGEX.test(unitArg)) {
      return {
        line: callExpr.getStartLineNumber(),
        message:
          'Legacy .diff() with calendar unit used to calculate date/time differentials instead of Temporal.Duration or Temporal.ZonedDateTime.since()/.until().',
      };
    }
  }

  return null;
}

export const calculateEventDifferentialsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    '86400000',
    '3600000',
    '60000',
    '86400',
    '3600',
    '864e5',
    '36e5',
    '6e4',
    '1000',
    'getTime',
    'Date.now',
    'Date.parse',
    'valueOf',
    'diff',
    'Temporal',
    'moment',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binExpr of binaryExpressions) {
      const divMatch = matchDivisionDifferential(binExpr);
      if (divMatch) {
        matches.push(divMatch);
        continue;
      }

      const subMatch = matchDirectDateSubtraction(binExpr);
      if (subMatch) {
        matches.push(subMatch);
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
    'Flag legacy arithmetic date differential math (dividing Date timestamp subtractions by calendar constants like 86400000, 86400) or moment.diff() calls instead of Temporal.ZonedDateTime and Temporal.Duration.',
  matcher: calculateEventDifferentialsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Computing elapsed duration, days, hours, or minutes between two Date instances or timestamps using arithmetic millisecond division (/ 86400000, / 3600000, / 60000) instead of Temporal.Duration or Temporal.ZonedDateTime.since()/.until().',
      'Direct Date timestamp subtractions (such as a.getTime() - b.getTime() or Date.now() - a.getTime()) used to measure time intervals.',
      'Legacy date library differential calls (such as moment(...).diff(..., "days") or dayjs(...).diff(..., "hours")) used for calendar interval calculation.',
    ],
    dropWhen: [
      'High-precision performance measurement deltas using performance.now() - startTime.',
      'Simple execution benchmark timers where timing variables are explicitly named bench, perf, t0, or t1.',
      'Code guarded by feature detection for native Temporal support.',
    ],
  },
};
