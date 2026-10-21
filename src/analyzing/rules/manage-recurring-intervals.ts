import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const MANAGE_RECURRING_INTERVALS_GUIDE_HASH = '70de814bc3cc';

const TEMPORAL_GUARD_TOKENS = ['Temporal', '@js-temporal/polyfill'] as const;

const DATE_CALENDAR_SETTERS = new Set([
  'setMonth',
  'setUTCMonth',
  'setFullYear',
  'setUTCFullYear',
]);

const MOMENT_INTERVAL_METHODS = new Set(['add', 'subtract']);

// Case-sensitive calendar units: years, months, y, M. Excludes 'm' (minutes).
const CALENDAR_INTERVAL_UNITS = /^['"](years?|months?|y|M)['"]$/;

/**
 * Checks whether an argument expression contains binary addition (+) or subtraction (-),
 * e.g., d.getMonth() + 1, d.getFullYear() + 1 on the SAME receiver.
 */
function hasArithmeticOperationOnSameReceiver(argNode: Node, expectedReceiverText: string): boolean {
  const unwrapped = unwrapExpression(argNode);

  const checkBinary = (b: Node): boolean => {
    if (!Node.isBinaryExpression(b)) return false;
    const op = b.getOperatorToken().getKind();
    if (op !== SyntaxKind.PlusToken && op !== SyntaxKind.MinusToken) return false;

    // One of the operands must be a getMonth/getFullYear call on the same receiver
    const left = unwrapExpression(b.getLeft());
    const right = unwrapExpression(b.getRight());

    const isMatchingGetter = (n: Node): boolean => {
      if (Node.isCallExpression(n)) {
        const expr = unwrapExpression(n.getExpression());
        if (Node.isPropertyAccessExpression(expr)) {
          const name = expr.getName();
          if (name === 'getMonth' || name === 'getUTCMonth' || name === 'getFullYear' || name === 'getUTCFullYear') {
            const caller = unwrapExpression(expr.getExpression()).getText();
            return caller === expectedReceiverText;
          }
        }
      }
      return false;
    };

    return isMatchingGetter(left) || isMatchingGetter(right);
  };

  if (checkBinary(unwrapped)) {
    return true;
  }

  const binaryDescs = unwrapped.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  return binaryDescs.some((b) => checkBinary(b));
}

/**
 * Matches legacy mutable Date calendar setter mutations for monthly/annual recurring intervals:
 * d.setMonth(d.getMonth() + 1), d.setFullYear(d.getFullYear() + 1), etc.
 */
function matchDateCalendarSetter(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (!DATE_CALENDAR_SETTERS.has(methodName)) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  // Skip setters that pass an explicit day parameter (e.g. setMonth(m + 1, 0) or (m + 1, 1))
  if (args.length > 1) {
    return null;
  }

  const receiverText = unwrapExpression(expr.getExpression()).getText();

  // The first argument must involve addition or subtraction (+ or -) with getter on the SAME receiver
  if (!hasArithmeticOperationOnSameReceiver(args[0], receiverText)) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Legacy mutable Date calendar arithmetic (d.${methodName}(... + ...)) used instead of Temporal.PlainDate.prototype.add({ months: 1 }).`,
  };
}

/**
 * Matches moment(...).add(..., 'months' | 'years') / moment(...).subtract(...) / dayjs(...).add(...)
 */
function matchMomentDayjsAdd(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (!MOMENT_INTERVAL_METHODS.has(methodName)) {
    return null;
  }

  const callerExpr = unwrapExpression(expr.getExpression());
  const callerText = callerExpr.getText();

  // Must explicitly be moment or dayjs, NEVER a Temporal or plain object
  const isMomentOrDayjsCaller =
    callerText.includes('moment') ||
    callerText.includes('dayjs');

  if (!isMomentOrDayjsCaller) {
    return null;
  }

  const args = callExpr.getArguments();
  let hasCalendarUnit = false;

  if (args.length >= 2) {
    const unitArg = unwrapExpression(args[1]).getText();
    if (CALENDAR_INTERVAL_UNITS.test(unitArg)) {
      hasCalendarUnit = true;
    }
  } else if (args.length === 1) {
    // moment.add({ months: 1 })
    const arg = unwrapExpression(args[0]);
    if (Node.isObjectLiteralExpression(arg)) {
      const propNames = arg.getProperties().map((p) => {
        if (Node.isPropertyAssignment(p)) {
          return p.getName();
        }
        return '';
      });
      hasCalendarUnit = propNames.some((p) => /^(years?|months?|y|M)$/.test(p));
    }
  }

  if (!hasCalendarUnit) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Legacy date library month/year interval arithmetic (.${methodName}(..., calendarUnit)) used instead of Temporal.PlainDate.prototype.add().`,
  };
}

export const manageRecurringIntervalsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'setMonth',
    'setUTCMonth',
    'setFullYear',
    'setUTCFullYear',
    'add',
    'subtract',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const dateMatch = matchDateCalendarSetter(callExpr);
      if (dateMatch) {
        matches.push(dateMatch);
        continue;
      }

      const momentMatch = matchMomentDayjsAdd(callExpr);
      if (momentMatch) {
        matches.push(momentMatch);
      }
    }

    return matches;
  },
};

export const manageRecurringIntervalsRule: AnalyzerRule = {
  id: 'manage-recurring-intervals',
  guideId: 'manage-recurring-intervals',
  guideHash: MANAGE_RECURRING_INTERVALS_GUIDE_HASH,
  summary:
    'Flag legacy mutable Date monthly/annual calendar-period mutation (d.setMonth(d.getMonth() + 1), d.setFullYear(d.getFullYear() + 1)) or moment/dayjs month/year .add()/.subtract() calls instead of Temporal.PlainDate.prototype.add().',
  matcher: manageRecurringIntervalsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Legacy mutable Date calendar-period mutation (such as d.setMonth(d.getMonth() + 1) or d.setFullYear(d.getFullYear() + 1)) used to compute recurring monthly or annual billing/payroll cycles instead of Temporal.PlainDate.prototype.add({ months: 1 }, { overflow: "constrain" }).',
      'Third-party date library recurring month/year interval arithmetic (such as moment(...).add(..., "months") or dayjs(...).add(..., "years")) used for recurring schedule calculation.',
      'Date prototype extensions or date-wrapper utility methods (e.g., Date#add, addMonths, addYears) that compute recurring month or year arithmetic via setMonth(getMonth() + n) or setFullYear(getFullYear() + n), even when wrapped in a helper returning this',
    ],
    dropWhen: [
      'Simple day or week offsets (such as d.setDate(d.getDate() + 7) or dayjs().add(7, "days")) that do not involve month-end calendar clamping.',
      'Code already protected by feature detection for native Temporal or polyfill loading (@js-temporal/polyfill).',
      'Direct timestamp setters with fixed scalar values (such as d.setHours(0, 0, 0, 0) or d.setMonth(0)) without plus/minus duration arithmetic.',
      'Setters passing an explicit day argument (e.g. setMonth(m + 1, 0) or setMonth(m + 1, 1)) or 1-based index conversion (setMonth(m - 1)).',
      'Native Temporal arithmetic (e.g. plainDate.add({ months: 1 })).',
    ],
  },
};

/**
 * Opt-in only until re-measured: retired from default production scan per Slice 5 audit.
 */
export const manageRecurringIntervalsRules: readonly AnalyzerRule[] = [];
