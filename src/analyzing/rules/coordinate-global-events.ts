import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const COORDINATE_GLOBAL_EVENTS_GUIDE_HASH = 'ae06aecc3df1';

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

const EXCLUDED_DATE_METHODS = new Set([
  'toISOString',
  'toUTCString',
  'setMinutes',
  'setUTCMinutes',
  'setHours',
  'setUTCHours',
  'now',
  'fromNow',
  'toNow',
  'diff',
  'cookie',
]);

function hasExcludedDateOrLocalShiftAst(scope: Node): boolean {
  for (const prop of scope.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (EXCLUDED_DATE_METHODS.has(prop.getName())) {
      return true;
    }
  }
  for (const newExpr of scope.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    if (unwrapExpression(newExpr.getExpression()).getText() === 'Date') {
      const args = newExpr.getArguments();
      if (args.length === 1 && Node.isBinaryExpression(unwrapExpression(args[0]))) {
        return true;
      }
    }
  }
  return false;
}

function hasMultiTimezoneContext(callExpr: CallExpression): boolean {
  let stmt: Node | undefined = callExpr;
  while (stmt && !Node.isStatement(stmt)) {
    stmt = stmt.getParent();
  }
  if (stmt && hasExcludedDateOrLocalShiftAst(stmt)) {
    return false;
  }

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

  if (!fn || hasExcludedDateOrLocalShiftAst(fn) || fn.getParameters().length !== 2) {
    return false;
  }

  const paramNames = new Set(fn.getParameters().map((p) => p.getName()));
  const decl = callExpr.getParent();
  if (decl && Node.isVariableDeclaration(decl)) {
    const varName = decl.getName();
    return fn.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
      const op = bin.getOperatorToken().getKind();
      if (op !== SyntaxKind.PlusToken && op !== SyntaxKind.MinusToken) return false;
      const left = unwrapExpression(bin.getLeft());
      const right = unwrapExpression(bin.getRight());
      if (!Node.isIdentifier(left) || !Node.isIdentifier(right)) return false;
      return (
        (left.getText() === varName && paramNames.has(right.getText())) ||
        (right.getText() === varName && paramNames.has(left.getText()))
      );
    });
  }

  return isChainedUtcLocal(callExpr);
}

function isTimezoneArithmeticUsage(callExpr: CallExpression): boolean {
  const directParent = callExpr.getParent();
  if (directParent && Node.isReturnStatement(directParent)) {
    return false;
  }

  if (directParent && Node.isPropertyAssignment(directParent)) {
    return false;
  }

  if (directParent && Node.isBinaryExpression(directParent)) {
    if (
      directParent.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
      directParent.getRight() === callExpr
    ) {
      return false;
    }
  }

  let currentNode: Node | undefined = callExpr;
  while (currentNode && !Node.isStatement(currentNode)) {
    const parentExpression = currentNode.getParent();
    if (parentExpression && Node.isBinaryExpression(parentExpression)) {
      const operatorKind = parentExpression.getOperatorToken().getKind();
      if (
        operatorKind === SyntaxKind.AsteriskToken ||
        operatorKind === SyntaxKind.PlusToken ||
        operatorKind === SyntaxKind.MinusToken ||
        operatorKind === SyntaxKind.SlashToken
      ) {
        return true;
      }
    }
    if (parentExpression && Node.isCallExpression(parentExpression)) {
      const calleeText = unwrapExpression(parentExpression.getExpression()).getText();
      if (
        calleeText.includes('setMinutes') ||
        calleeText.includes('setHours') ||
        calleeText.includes('setTime') ||
        calleeText.includes('Date.UTC')
      ) {
        return true;
      }
    }
    currentNode = parentExpression;
  }

  if (
    directParent &&
    Node.isVariableDeclaration(directParent) &&
    directParent.getInitializer() === callExpr
  ) {
    const varName = directParent.getName();
    let scopeNode: Node | undefined = directParent.getParent();
    while (
      scopeNode &&
      !Node.isFunctionDeclaration(scopeNode) &&
      !Node.isFunctionExpression(scopeNode) &&
      !Node.isArrowFunction(scopeNode) &&
      !Node.isSourceFile(scopeNode)
    ) {
      scopeNode = scopeNode.getParent();
    }
    if (scopeNode) {
      for (const id of scopeNode.getDescendantsOfKind(SyntaxKind.Identifier)) {
        if (id.getText() !== varName || id === directParent.getNameNode()) continue;
        const parent = id.getParent();
        if (parent && Node.isBinaryExpression(parent)) {
          const op = parent.getOperatorToken().getKind();
          if (
            op === SyntaxKind.AsteriskToken ||
            op === SyntaxKind.PlusToken ||
            op === SyntaxKind.MinusToken ||
            op === SyntaxKind.SlashToken
          ) {
            return true;
          }
        }
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
    if (!isTimezoneArithmeticUsage(callExpr)) {
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
    // Exclude getter with 0 args like m.tz() or 3-arg custom format string parsers moment.tz(input, format, tz)
    if (args.length === 0 || args.length >= 3) {
      return null;
    }

    let stmt: Node | undefined = callExpr;
    while (stmt && !Node.isStatement(stmt)) {
      stmt = stmt.getParent();
    }
    if (stmt && hasExcludedDateOrLocalShiftAst(stmt)) {
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

  // 3. moment.utc(...).local() or chained utc/local in a multi-timezone context
  if (isChainedUtcLocal(callExpr)) {
    if (
      isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS) ||
      !hasMultiTimezoneContext(callExpr)
    ) {
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
  fastTokens: [
    'getTimezoneOffset',
    'moment.tz',
    'dayjs.tz',
    '.tz(',
    'moment.utc',
    'dayjs.utc',
    '.utc(',
    'Date.UTC',
  ],
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
  verifierRubric: {
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
export default [
  coordinateGlobalEventsRule,
] satisfies readonly AnalyzerRule[];
