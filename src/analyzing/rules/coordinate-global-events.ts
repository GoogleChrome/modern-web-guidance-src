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

const MULTI_TIMEZONE_REGEX =
  /(time_?zone|timezone|iana|target_?tz|dest_?tz|source_?tz|utc_?offset|tz_?offset|dst_?offset|zone_?name)/i;

const RELATIVE_TIME_OR_EXCLUDED_FN_REGEX =
  /(time_?ago|from_?now|time_?since|duration|elapsed|cookie)/i;

function hasMultiTimezoneContext(callExpr: CallExpression): boolean {
  let stmt: Node | undefined = callExpr;
  while (stmt && !Node.isStatement(stmt)) {
    stmt = stmt.getParent();
  }

  const stmtText = stmt ? stmt.getText() : '';

  // 1. Drop simple .toISOString() local date formatting
  if (stmtText.includes('.toISOString()')) {
    return false;
  }

  // 2. Drop .setMinutes() or .setUTCMinutes() or .setHours() local shifting
  if (
    stmtText.includes('.setMinutes(') ||
    stmtText.includes('.setUTCMinutes(') ||
    stmtText.includes('.setHours(')
  ) {
    return false;
  }

  // 3. Drop cookie expiration / toUTCString
  if (stmtText.includes('cookie') || stmtText.includes('.toUTCString()')) {
    return false;
  }

  // 4. Find enclosing function or scope
  let fn: Node | undefined = callExpr;
  while (fn) {
    if (
      Node.isFunctionDeclaration(fn) ||
      Node.isFunctionExpression(fn) ||
      Node.isArrowFunction(fn) ||
      Node.isMethodDeclaration(fn)
    ) {
      break;
    }
    fn = fn.getParent();
  }

  if (fn) {
    if (
      Node.isFunctionDeclaration(fn) ||
      Node.isMethodDeclaration(fn)
    ) {
      const fnName = fn.getName() ?? '';
      if (RELATIVE_TIME_OR_EXCLUDED_FN_REGEX.test(fnName)) {
        return false;
      }
    }

    const fnText = fn.getText();
    if (RELATIVE_TIME_OR_EXCLUDED_FN_REGEX.test(fnText)) {
      if (
        fnText.includes('timeAgo') ||
        fnText.includes('fromNow') ||
        fnText.includes('timeSince')
      ) {
        return false;
      }
    }

    // Check for explicit multi-timezone tokens in the function/statement
    // Strip getTimezoneOffset itself to prevent tautological self-match
    const sanitizedFn = fnText.replace(/getTimezoneOffset/g, '');
    if (MULTI_TIMEZONE_REGEX.test(sanitizedFn)) {
      return true;
    }
  }

  // At statement level
  if (stmt) {
    const sanitizedStmt = stmtText.replace(/getTimezoneOffset/g, '');
    if (MULTI_TIMEZONE_REGEX.test(sanitizedStmt)) {
      return true;
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
    if (!hasMultiTimezoneContext(callExpr)) {
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

    const args = callExpr.getArguments();
    // Exclude getter with 0 args like m.tz()
    if (args.length === 0) {
      return null;
    }

    // Exclude unverified receivers like user.profile.tz()
    const lowerCaller = callerText.toLowerCase();
    const isLikelyDateReceiver =
      lowerCaller.includes('moment') ||
      lowerCaller.includes('dayjs') ||
      lowerCaller.includes('date') ||
      lowerCaller.includes('stamp') ||
      lowerCaller.includes('time') ||
      lowerCaller.includes('row.') ||
      Node.isCallExpression(callerExpr);

    if (!isLikelyDateReceiver) {
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
      'Manual timezone offset math using Date.prototype.getTimezoneOffset() specifically to convert timestamps across different geographical time zones or against target IANA time zones.',
      'Legacy timezone library calls (such as moment.tz, moment().tz, or moment.utc().local()) used to coordinate, convert, or format dates in specific IANA time zones.',
      'Converting or scheduling calendar events, meetings, or timestamps across multiple time zones without Temporal.ZonedDateTime or Intl.DateTimeFormat timeZone option.',
    ],
    dropWhen: [
      'Local ISO string formatting using .toISOString() (e.g., new Date(d - d.getTimezoneOffset() * 60000).toISOString()).',
      'Local time shifting via setMinutes(d.getMinutes() - d.getTimezoneOffset()) or calendar date-picker local day alignment.',
      'Relative time calculations, elapsed duration deltas, or "time ago" formatting (e.g., timeAgo, fromNow, timeSince).',
      'Single-timezone local UI display, local clock display, or cookie expiration calculation.',
      'Code already protected by a feature guard checking for native Temporal support.',
      'Internal polyfills or ponyfills implementing Temporal itself.',
      'Unverified receiver calls or getter calls without arguments (e.g. user.profile.tz() or moment().tz()).',
    ],
  },
};

/**
 * Opt-in only until re-measured: retired from default production scan.
 */
export const coordinateGlobalEventsRules: readonly AnalyzerRule[] = [
  coordinateGlobalEventsRule,
];
