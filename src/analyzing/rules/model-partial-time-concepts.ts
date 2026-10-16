import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const MODEL_PARTIAL_TIME_CONCEPTS_GUIDE_HASH = '264c7b491820';

const TEMPORAL_FEATURE_TOKENS = [
  'Temporal',
  'PlainDate',
  'PlainYearMonth',
  'PlainMonthDay',
  'PlainTime',
] as const;

/**
 * Checks whether an argument is literal numeric 0 or string '0'.
 */
function isZeroLiteral(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isNumericLiteral(unwrapped)) {
    return unwrapped.getLiteralValue() === 0;
  }
  if (Node.isStringLiteral(unwrapped)) {
    return unwrapped.getLiteralText() === '0';
  }
  return false;
}

/**
 * Matches .setHours(0, 0, 0, 0) or .setUTCHours(0, 0, 0, 0) calls used to
 * strip time components from a Date object to model a calendar date.
 */
function matchStripTimeHoursCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (methodName !== 'setHours' && methodName !== 'setUTCHours') {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 3 || !args.every(isZeroLiteral)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      `Zeroing time components via .${methodName}(0, 0, 0, 0) on Date to model calendar date can be replaced with native Temporal (Temporal.PlainDate, Temporal.PlainYearMonth, or Temporal.PlainMonthDay).`,
  };
}

export const modelPartialTimeConceptsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['setHours', 'setUTCHours'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, TEMPORAL_FEATURE_TOKENS)) {
        return;
      }

      const match = matchStripTimeHoursCall(node);
      if (!match) {
        return;
      }

      if (visitedLines.has(match.line)) {
        return;
      }
      visitedLines.add(match.line);
      matches.push(match);
    });

    return matches;
  },
};

export const modelPartialTimeConceptsJsRule: AnalyzerRule = {
  id: 'model-partial-time-concepts/js-strip-time-hours',
  guideId: 'model-partial-time-concepts',
  guideHash: MODEL_PARTIAL_TIME_CONCEPTS_GUIDE_HASH,
  summary:
    'Stripping time components from Date via .setHours(0, 0, 0, 0) or .setUTCHours(0, 0, 0, 0) to represent calendar dates can be modernized with native Temporal types.',
  matcher: modelPartialTimeConceptsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Zeroing out time fields on a JavaScript Date object via .setHours(0, 0, 0, 0) or .setUTCHours(0, 0, 0, 0) to represent a date-only concept or start-of-day boundary.',
      'Manipulating Date instances with placeholder time values to compare calendar dates or represent partial time concepts.',
    ],
    dropWhen: [
      'Code already utilizing native Temporal types such as Temporal.PlainDate, Temporal.PlainYearMonth, or Temporal.PlainTime.',
      'Setting specific non-zero hours or dynamic scheduled run-times (such as date.setHours(alarmHour, alarmMinute)).',
      'Protected by a runtime or polyfill check for globalThis.Temporal.',
    ],
  },
};

export const modelPartialTimeConceptsRules: readonly AnalyzerRule[] = [
  modelPartialTimeConceptsJsRule,
];
