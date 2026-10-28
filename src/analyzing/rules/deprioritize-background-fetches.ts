import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const DEPRIORITIZE_BACKGROUND_FETCHES_GUIDE_HASH = 'd4df9c73f767';

const VALID_IMPORTANCE_VALUES = new Set(['low', 'high', 'auto']);
const PRIORITY_GUARD_TOKENS = ['priority', 'Request'] as const;

function getPropertyKeyName(prop: Node): string | null {
  if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) {
    return null;
  }
  const nameNode = prop.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }
  return null;
}

function extractDeprecatedImportanceFromInit(
  initNode: Node,
): { line: number; value: string } | null {
  const resolved = resolveLocalExpression(initNode);
  if (!Node.isObjectLiteralExpression(resolved)) {
    return null;
  }

  let hasPriority = false;
  let importanceLine: number | null = null;
  let importanceVal: string | null = null;

  for (const prop of (resolved as ObjectLiteralExpression).getProperties()) {
    const key = getPropertyKeyName(prop);
    if (key === 'priority') {
      hasPriority = true;
    } else if (key === 'importance' && Node.isPropertyAssignment(prop)) {
      const init = unwrapExpression(prop.getInitializerOrThrow());
      if (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init)) {
        const val = init.getLiteralText().trim().toLowerCase();
        if (VALID_IMPORTANCE_VALUES.has(val)) {
          importanceLine = prop.getStartLineNumber();
          importanceVal = val;
        }
      }
    }
  }

  if (hasPriority || importanceLine === null || importanceVal === null) {
    return null;
  }

  return { line: importanceLine, value: importanceVal };
}

function matchFetchOrRequestInit(
  node: CallExpression | NewExpression,
): AnalyzerMatch | null {
  const callee = unwrapExpression(node.getExpression());
  const isFetchCall =
    Node.isCallExpression(node) && isGlobalReference(callee, 'fetch');
  const isRequestCtor =
    Node.isNewExpression(node) && isGlobalReference(callee, 'Request');

  if (!isFetchCall && !isRequestCtor) {
    return null;
  }

  const args = node.getArguments();
  if (args.length < 2) {
    return null;
  }

  if (isProtectedByFeatureGuard(node, PRIORITY_GUARD_TOKENS)) {
    return null;
  }

  const hit = extractDeprecatedImportanceFromInit(args[1]!);
  if (!hit) {
    return null;
  }

  return {
    line: node.getStartLineNumber(),
    message: `Deprecated RequestInit option importance: '${hit.value}' in ${isFetchCall ? 'fetch()' : 'new Request()'}; use standard priority: '${hit.value}' instead.`,
  };
}

export const deprioritizeBackgroundFetchesMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['importance'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const match = matchFetchOrRequestInit(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const match = matchFetchOrRequestInit(newExpr);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const deprioritizeBackgroundFetchesRule: AnalyzerRule = {
  id: 'deprioritize-background-fetches',
  guideId: 'deprioritize-background-fetches',
  guideHash: DEPRIORITIZE_BACKGROUND_FETCHES_GUIDE_HASH,
  summary:
    "Replace deprecated importance option in fetch() / RequestInit with priority: 'low' | 'high'.",
  matcher: deprioritizeBackgroundFetchesMatcher,
  verifierRubric: {
    keepWhen: [
      "A fetch(url, options) or new Request(url, options) call passes the deprecated importance: 'low' | 'high' | 'auto' key in its RequestInit options object instead of priority.",
    ],
    dropWhen: [
      "The RequestInit object already specifies priority: 'low' or priority: 'high'.",
      "An importance property appears on a non-fetch domain object (such as application state, notification config, or search weights).",
    ],
  },
};

export default [
  deprioritizeBackgroundFetchesRule,
] satisfies readonly AnalyzerRule[];
