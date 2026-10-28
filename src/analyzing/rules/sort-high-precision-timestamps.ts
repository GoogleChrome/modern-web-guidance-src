import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SORT_HIGH_PRECISION_TIMESTAMPS_GUIDE_HASH = '3e333eb82a0d';

const TEMPORAL_GUARD_TOKENS = ['Temporal', 'Temporal.Instant'] as const;

const HIGH_PRECISION_TIMESTAMP_PROP_REGEX =
  /^(?:timestamp|timestampIso|isoTimestamp|transactionTimestamp|eventTimestamp|logTimestamp|eventTime|occurredAt|recordedAt|loggedAt|traceTime|spanTime|createdAt|updatedAt|created_at|updated_at|occurred_at|recorded_at|event_time|ts|iso|time)$/;

interface ParsedTimestampAccess {
  readonly paramName: string;
  readonly propName: string;
}

function extractParamTimestampProperty(argNode: Node): ParsedTimestampAccess | null {
  const unwrapped = unwrapExpression(argNode);
  if (!Node.isPropertyAccessExpression(unwrapped)) {
    return null;
  }
  const propName = unwrapped.getName();
  if (!HIGH_PRECISION_TIMESTAMP_PROP_REGEX.test(propName)) {
    return null;
  }
  const obj = unwrapExpression(unwrapped.getExpression());
  if (!Node.isIdentifier(obj)) {
    return null;
  }
  return { paramName: obj.getText(), propName };
}

function extractDateMsOperand(operandNode: Node): ParsedTimestampAccess | null {
  const unwrapped = unwrapExpression(operandNode);

  // +new Date(a.timestamp)
  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.PlusToken
  ) {
    return extractDateMsOperand(unwrapped.getOperand());
  }

  // new Date(a.timestamp)
  if (Node.isNewExpression(unwrapped)) {
    if (!isGlobalReference(unwrapped.getExpression(), 'Date')) {
      return null;
    }
    const args = unwrapped.getArguments();
    if (args.length !== 1) {
      return null;
    }
    return extractParamTimestampProperty(args[0]!);
  }

  if (Node.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.getExpression());

    // Number(new Date(a.timestamp))
    if (isGlobalReference(callee, 'Number')) {
      const args = unwrapped.getArguments();
      if (args.length === 1) {
        return extractDateMsOperand(args[0]!);
      }
      return null;
    }

    if (Node.isPropertyAccessExpression(callee)) {
      const methodName = callee.getName();
      const target = unwrapExpression(callee.getExpression());

      // Date.parse(a.timestamp)
      if (methodName === 'parse' && isGlobalReference(target, 'Date')) {
        const args = unwrapped.getArguments();
        if (args.length === 1) {
          return extractParamTimestampProperty(args[0]!);
        }
        return null;
      }

      // new Date(a.timestamp).getTime() or .valueOf()
      if (
        (methodName === 'getTime' || methodName === 'valueOf') &&
        unwrapped.getArguments().length === 0 &&
        Node.isNewExpression(target) &&
        isGlobalReference(target.getExpression(), 'Date')
      ) {
        const ctorArgs = target.getArguments();
        if (ctorArgs.length === 1) {
          return extractParamTimestampProperty(ctorArgs[0]!);
        }
      }
    }
  }

  return null;
}

function findComparatorSubtraction(bodyNode: Node): BinaryExpression | null {
  const unwrapped = unwrapExpression(bodyNode);
  if (
    Node.isBinaryExpression(unwrapped) &&
    unwrapped.getOperatorToken().getKind() === SyntaxKind.MinusToken
  ) {
    return unwrapped;
  }

  if (Node.isBlock(unwrapped)) {
    const stmts = unwrapped.getStatements();
    if (stmts.length === 1 && Node.isReturnStatement(stmts[0]!)) {
      const retExpr = stmts[0].getExpression();
      if (retExpr) {
        return findComparatorSubtraction(retExpr);
      }
    }
  }

  return null;
}

function matchTimestampSortCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (methodName !== 'sort' && methodName !== 'toSorted') {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length !== 1) {
    return null;
  }

  const comparator = unwrapExpression(args[0]!);
  if (!Node.isArrowFunction(comparator) && !Node.isFunctionExpression(comparator)) {
    return null;
  }

  const params = comparator.getParameters();
  if (params.length !== 2) {
    return null;
  }

  const paramA = params[0]!.getNameNode();
  const paramB = params[1]!.getNameNode();
  if (!Node.isIdentifier(paramA) || !Node.isIdentifier(paramB)) {
    return null;
  }
  const paramSet = new Set([paramA.getText(), paramB.getText()]);

  const subtraction = findComparatorSubtraction(comparator.getBody());
  if (!subtraction) {
    return null;
  }

  const leftAccess = extractDateMsOperand(subtraction.getLeft());
  const rightAccess = extractDateMsOperand(subtraction.getRight());
  if (!leftAccess || !rightAccess) {
    return null;
  }

  if (
    leftAccess.propName !== rightAccess.propName ||
    leftAccess.paramName === rightAccess.paramName ||
    !paramSet.has(leftAccess.paramName) ||
    !paramSet.has(rightAccess.paramName)
  ) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Sorting timestamp property '${leftAccess.propName}' via Date millisecond parsing truncates sub-millisecond precision; parse ISO timestamps with Temporal.Instant.from() and order with Temporal.Instant.compare().`,
  };
}

export const sortHighPrecisionTimestampsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['.sort(', '.toSorted('],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const content = ctx.fileContent;
    if (
      (!content.includes('Date.parse') && !content.includes('new Date')) ||
      content.includes('Temporal.Instant')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const match = matchTimestampSortCall(callExpr);
      if (match) {
        matches.push(match);
      }
    }
    return matches;
  },
};

export const sortHighPrecisionTimestampsRule: AnalyzerRule = {
  id: 'sort-high-precision-timestamps',
  guideId: 'sort-high-precision-timestamps',
  guideHash: SORT_HIGH_PRECISION_TIMESTAMPS_GUIDE_HASH,
  summary:
    'Replace Date.parse() or new Date().getTime() subtraction in .sort() / .toSorted() timestamp comparators with Temporal.Instant.compare() to preserve sub-millisecond ordering.',
  matcher: sortHighPrecisionTimestampsMatcher,
  verifierRubric: {
    keepWhen: [
      'An Array .sort() or .toSorted() comparator parses ISO 8601 timestamp properties (such as timestamp, ts, eventTime, occurredAt, createdAt, updatedAt, iso, or time) with Date.parse(), new Date(...).getTime(), or +new Date(...) to order events, logs, traces, messages, or timeline entries instead of Temporal.Instant.compare().',
    ],
    dropWhen: [
      'Sorting coarse calendar dates (such as birthDate, dueDate, deadlineDate, releaseDate, year, month, or day) where sub-millisecond precision is irrelevant.',
      'Sorting numeric epoch millisecond numbers directly (such as a.timestamp - b.timestamp without Date.parse or new Date) or using performance.now() intervals.',
      'Code already using Temporal.Instant.compare() or guarded by a Temporal feature check.',
    ],
  },
};

export default [
  sortHighPrecisionTimestampsRule,
] satisfies readonly AnalyzerRule[];
