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
  'setDate',
  'setUTCDate',
]);

const MOMENT_INTERVAL_METHODS = new Set(['add', 'subtract']);

const CALENDAR_INTERVAL_UNITS =
  /^['"](years?|months?|weeks?|days?|y|M|w|d)['"]$/i;

/**
 * Checks whether an argument expression contains binary addition (+) or subtraction (-),
 * e.g., d.getMonth() + 1, d.getDate() + 7, d.getFullYear() + 1.
 */
function hasArithmeticOperation(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isBinaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken().getKind();
    if (op === SyntaxKind.PlusToken || op === SyntaxKind.MinusToken) {
      return true;
    }
  }

  const binaryDescs = unwrapped.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  return binaryDescs.some((b) => {
    const op = b.getOperatorToken().getKind();
    return op === SyntaxKind.PlusToken || op === SyntaxKind.MinusToken;
  });
}

/**
 * Matches legacy mutable Date calendar setter mutations:
 * d.setMonth(d.getMonth() + 1), d.setDate(d.getDate() + 7), etc.
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

  // The first argument must involve addition or subtraction (+ or -)
  if (!hasArithmeticOperation(args[0])) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Legacy mutable Date calendar arithmetic (d.${methodName}(... + ...)) used instead of Temporal.PlainDate.prototype.add().`,
  };
}

/**
 * Matches moment(...).add(..., 'months') / moment(...).subtract(...) / dayjs(...).add(...)
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

  const callerText = expr.getExpression().getText();
  const isMomentOrDayjsCaller =
    callerText.includes('moment') ||
    callerText.includes('dayjs') ||
    callerText.includes('date') ||
    callerText.includes('Date');

  const args = callExpr.getArguments();
  let hasCalendarUnit = false;

  if (args.length >= 2) {
    const unitArg = unwrapExpression(args[1]).getText();
    if (CALENDAR_INTERVAL_UNITS.test(unitArg)) {
      hasCalendarUnit = true;
    }
  } else if (args.length === 1) {
    // moment.add({ months: 1 }) or moment.add(1, 'month')
    const arg = unwrapExpression(args[0]);
    if (Node.isObjectLiteralExpression(arg)) {
      const propNames = arg.getProperties().map((p) => {
        if (Node.isPropertyAssignment(p)) {
          return p.getName();
        }
        return '';
      });
      hasCalendarUnit = propNames.some((p) =>
        /^(years?|months?|weeks?|days?|y|M|w|d)$/i.test(p),
      );
    }
  }

  if (!hasCalendarUnit) {
    return null;
  }

  if (!isMomentOrDayjsCaller && args.length < 2) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Legacy date library interval arithmetic (.${methodName}(..., calendarUnit)) used instead of Temporal.PlainDate.prototype.add().`,
  };
}

export const manageRecurringIntervalsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'setMonth',
    'setUTCMonth',
    'setFullYear',
    'setUTCFullYear',
    'setDate',
    'setUTCDate',
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
    'Flag legacy mutable Date calendar-period mutation (d.setMonth(d.getMonth() + 1), d.setDate(d.getDate() + 7)) or moment/dayjs .add()/.subtract() calls instead of Temporal.PlainDate.prototype.add().',
  matcher: manageRecurringIntervalsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Legacy mutable Date calendar-period mutation (such as d.setMonth(d.getMonth() + 1) or d.setDate(d.getDate() + 7)) used to compute recurring dates instead of Temporal.PlainDate.prototype.add({ months: 1 }).',
      'Third-party date library recurring interval arithmetic (such as moment(...).add(..., "months") or dayjs(...).add(..., "days")) used for recurring schedule calculation.',
    ],
    dropWhen: [
      'Code already protected by feature detection for native Temporal or polyfill loading (@js-temporal/polyfill).',
      'Simple numeric millisecond timer intervals (such as setInterval(fn, 1000) or animation frames) that do not compute calendar intervals.',
      'Direct timestamp setters with fixed scalar values (such as d.setHours(0, 0, 0, 0) for start-of-day resets or d.setDate(1) for first-of-month anchoring) without plus/minus duration arithmetic.',
    ],
  },
};

export const manageRecurringIntervalsRules: readonly AnalyzerRule[] = [
  manageRecurringIntervalsRule,
];
