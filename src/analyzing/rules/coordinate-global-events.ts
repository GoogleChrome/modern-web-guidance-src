import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const COORDINATE_GLOBAL_EVENTS_GUIDE_HASH = '253dec2c89a2';

const TEMPORAL_GUARD_TOKENS = ['Temporal', '@js-temporal/polyfill'] as const;

function isChainedUtcLocal(callExpr: CallExpression): boolean {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }

  const methodName = expr.getName();
  const caller = unwrapExpression(expr.getExpression());

  // .local() called on .utc()
  if (methodName === 'local') {
    if (Node.isCallExpression(caller)) {
      const innerExpr = unwrapExpression(caller.getExpression());
      if (Node.isPropertyAccessExpression(innerExpr) && innerExpr.getName() === 'utc') {
        return true;
      }
    }
  }

  // .utc() called on .local()
  if (methodName === 'utc') {
    if (Node.isCallExpression(caller)) {
      const innerExpr = unwrapExpression(caller.getExpression());
      if (Node.isPropertyAccessExpression(innerExpr) && innerExpr.getName() === 'local') {
        return true;
      }
    }
  }

  return false;
}

function matchTimezoneCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  const callerExpr = unwrapExpression(expr.getExpression());
  const callerText = callerExpr.getText().trim();

  // 1. getTimezoneOffset()
  if (methodName === 'getTimezoneOffset') {
    if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
      return null;
    }
    return {
      line: callExpr.getStartLineNumber(),
      message:
        'Legacy getTimezoneOffset() manual offset math used instead of Temporal.ZonedDateTime or Intl.DateTimeFormat with timeZone',
    };
  }

  // 2. moment.tz(...) or moment(...).tz(...) or date.tz(...)
  if (methodName === 'tz') {
    if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
      return null;
    }
    return {
      line: callExpr.getStartLineNumber(),
      message:
        'Legacy timezone conversion (.tz()) used instead of Temporal.ZonedDateTime or Intl.DateTimeFormat with timeZone',
    };
  }

  // 3. moment.utc(...).local() or chained utc/local
  if (isChainedUtcLocal(callExpr)) {
    if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
      return null;
    }
    return {
      line: callExpr.getStartLineNumber(),
      message:
        'Legacy UTC/local conversion used instead of Temporal.ZonedDateTime or Intl.DateTimeFormat with timeZone',
    };
  }

  // 4. Direct moment.tz static call: moment.tz(...) where caller is moment
  if (callerText === 'moment' && methodName === 'tz') {
    if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
      return null;
    }
    return {
      line: callExpr.getStartLineNumber(),
      message:
        'Legacy moment.tz() timezone conversion used instead of Temporal.ZonedDateTime or Intl.DateTimeFormat with timeZone',
    };
  }

  return null;
}

export const coordinateGlobalEventsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['getTimezoneOffset', 'tz', 'moment', 'utc', 'Temporal'],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      const match = matchTimezoneCall(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const coordinateGlobalEventsRule: AnalyzerRule = {
  id: 'coordinate-global-events',
  guideId: 'coordinate-global-events',
  guideHash: COORDINATE_GLOBAL_EVENTS_GUIDE_HASH,
  summary:
    'Flag legacy timezone libraries and manual offset math (moment.tz, moment().tz, moment.utc().local(), or getTimezoneOffset()) used to coordinate dates across time zones instead of Temporal.ZonedDateTime or Intl.DateTimeFormat.',
  matcher: coordinateGlobalEventsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Manual timezone offset math using Date.prototype.getTimezoneOffset() to convert timestamps across timezones.',
      'Legacy timezone library calls (such as moment.tz, moment().tz, or moment.utc().local()) used to coordinate or format dates in specific IANA time zones.',
      'Converting or formatting timestamps across different geographical timezones without standard Temporal.ZonedDateTime or Intl.DateTimeFormat timeZone option.',
    ],
    dropWhen: [
      'Code already protected by a feature guard checking for native Temporal support.',
      'Generic UTC formatting (e.g. toISOString() or Date.UTC()) not doing timezone conversion or coordination.',
      'Internal polyfills or ponyfills implementing Temporal itself.',
    ],
  },
};
