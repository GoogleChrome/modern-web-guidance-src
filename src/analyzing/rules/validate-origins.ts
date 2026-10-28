import {
  Node,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type ArrowFunction,
  type MethodDeclaration,
  type SourceFile,
} from 'ts-morph';
import {
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

export const VALIDATE_ORIGINS_GUIDE_HASH = '552b863175a3';

const FEATURE_GUARD_TOKENS = [
  'Origin',
  'isSameOrigin',
  'isSameSite',
] as const;

const FRAGILE_ORIGIN_RECEIVER_METHODS = new Set([
  'startsWith',
  'endsWith',
  'includes',
  'indexOf',
  'lastIndexOf',
  'match',
  'search',
  'split',
  'slice',
  'substring',
  'substr',
  'replace',
]);

type FunctionLike =
  | FunctionDeclaration
  | FunctionExpression
  | ArrowFunction
  | MethodDeclaration;

function getMessageEventParamNames(fn: FunctionLike): Set<string> {
  const names = new Set<string>();
  const params = fn.getParameters();
  if (params.length > 0) {
    const first = params[0];
    const nameNode = first.getNameNode();
    if (Node.isIdentifier(nameNode)) {
      names.add(nameNode.getText());
    }
  }
  return names;
}

function findMessageHandlers(sourceFile: SourceFile): Array<{
  handler: FunctionLike;
  paramNames: Set<string>;
}> {
  const handlers: Array<{ handler: FunctionLike; paramNames: Set<string> }> = [];
  const seen = new Set<Node>();

  const addHandler = (node: Node) => {
    const resolved = Node.isIdentifier(node)
      ? resolveLocalExpression(node)
      : unwrapExpression(node);
    if (
      (Node.isFunctionDeclaration(resolved) ||
        Node.isFunctionExpression(resolved) ||
        Node.isArrowFunction(resolved) ||
        Node.isMethodDeclaration(resolved)) &&
      !seen.has(resolved)
    ) {
      seen.add(resolved);
      handlers.push({
        handler: resolved,
        paramNames: getMessageEventParamNames(resolved),
      });
    }
  };

  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expr = unwrapExpression(node.getExpression());
      const methodName = Node.isPropertyAccessExpression(expr)
        ? expr.getName()
        : Node.isIdentifier(expr)
          ? expr.getText()
          : '';
      if (methodName === 'addEventListener' || methodName === 'on') {
        const args = node.getArguments();
        if (args.length >= 2) {
          const firstArg = unwrapExpression(args[0]);
          if (
            Node.isStringLiteral(firstArg) &&
            firstArg.getLiteralText().toLowerCase() === 'message'
          ) {
            addHandler(args[1]);
          }
        }
      }
    } else if (Node.isBinaryExpression(node) && node.getOperatorToken().getText() === '=') {
      const left = unwrapExpression(node.getLeft());
      if (Node.isPropertyAccessExpression(left) && left.getName() === 'onmessage') {
        addHandler(node.getRight());
      }
    } else if (
      Node.isFunctionDeclaration(node) ||
      Node.isFunctionExpression(node) ||
      Node.isArrowFunction(node) ||
      Node.isMethodDeclaration(node)
    ) {
      const params = node.getParameters();
      if (params.length > 0) {
        const typeText = params[0].getTypeNode()?.getText() ?? '';
        if (/\bMessageEvent\b/.test(typeText)) {
          addHandler(node);
        }
      }
    }
  });

  return handlers;
}

function isEventOriginExpression(
  node: Node,
  paramNames: Set<string>,
  depth = 0,
): boolean {
  if (depth > 4) {
    return false;
  }
  const unwrapped = unwrapExpression(node);
  if (Node.isPropertyAccessExpression(unwrapped) && unwrapped.getName() === 'origin') {
    const obj = unwrapExpression(unwrapped.getExpression());
    if (Node.isIdentifier(obj) && paramNames.has(obj.getText())) {
      return true;
    }
    if (
      Node.isPropertyAccessExpression(obj) &&
      obj.getName() === 'originalEvent'
    ) {
      const inner = unwrapExpression(obj.getExpression());
      if (Node.isIdentifier(inner) && paramNames.has(inner.getText())) {
        return true;
      }
    }
  }
  if (Node.isIdentifier(unwrapped) && !paramNames.has(unwrapped.getText())) {
    const resolved = resolveLocalExpression(unwrapped);
    if (resolved !== unwrapped) {
      return isEventOriginExpression(resolved, paramNames, depth + 1);
    }
  }
  return false;
}

function isRegexReceiver(node: Node, depth = 0): boolean {
  if (depth > 4) {
    return false;
  }
  const unwrapped = unwrapExpression(node);
  if (Node.isRegularExpressionLiteral(unwrapped)) {
    return true;
  }
  if (Node.isNewExpression(unwrapped)) {
    return unwrapped.getExpression().getText() === 'RegExp';
  }
  if (Node.isIdentifier(unwrapped)) {
    const resolved = resolveLocalExpression(unwrapped);
    if (resolved !== unwrapped) {
      return isRegexReceiver(resolved, depth + 1);
    }
  }
  return false;
}

function isFragileOriginCall(
  call: CallExpression,
  paramNames: Set<string>,
): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const method = expr.getName();
  const receiver = expr.getExpression();

  // Case 1: event.origin.startsWith(...) / .includes(...) / .endsWith(...) / .indexOf(...) / .match(...)
  // Receiver MUST be event.origin (do not flag allowedOrigins.includes(event.origin))
  if (
    FRAGILE_ORIGIN_RECEIVER_METHODS.has(method) &&
    isEventOriginExpression(receiver, paramNames)
  ) {
    return true;
  }

  // Case 2: /.../.test(event.origin) or /.../.exec(event.origin)
  if (method === 'test' || method === 'exec') {
    const args = call.getArguments();
    if (
      args.length > 0 &&
      isEventOriginExpression(args[0], paramNames) &&
      isRegexReceiver(receiver)
    ) {
      return true;
    }
  }

  return false;
}

function isManualLocationConcatenation(node: Node): boolean {
  const text = node.getText();
  return (
    (Node.isBinaryExpression(node) || Node.isTemplateExpression(node)) &&
    /\blocation\.protocol\b/.test(text) &&
    /\blocation\.host(?:name)?\b/.test(text)
  );
}

const validateOriginsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    '.origin.',
    '.origin)',
    'location.protocol',
    '= event.origin',
    '= e.origin',
    '= evt.origin',
  ],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    if (
      (!ctx.fileContent.includes('message') && !ctx.fileContent.includes('MessageEvent')) ||
      ctx.fileContent.includes('Origin.from') ||
      ctx.fileContent.includes('isSameOrigin') ||
      ctx.fileContent.includes('isSameSite')
    ) {
      return matches;
    }

    const visitedLines = new Set<number>();
    const handlers = findMessageHandlers(sourceFile);

    for (const { handler, paramNames } of handlers) {
      if (paramNames.size === 0) {
        continue;
      }
      handler.forEachDescendant((node) => {
        let matched = false;
        if (Node.isCallExpression(node) && isFragileOriginCall(node, paramNames)) {
          matched = true;
        } else if (Node.isBinaryExpression(node)) {
          const op = node.getOperatorToken().getText();
          if (op === '===' || op === '!==' || op === '==' || op === '!=') {
            const left = node.getLeft();
            const right = node.getRight();
            if (
              (isEventOriginExpression(left, paramNames) &&
                isManualLocationConcatenation(right)) ||
              (isEventOriginExpression(right, paramNames) &&
                isManualLocationConcatenation(left))
            ) {
              matched = true;
            }
          }
        }

        if (!matched) {
          return;
        }
        if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) {
          return;
        }

        const line = node.getStartLineNumber();
        if (!visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'MessageEvent handler validates event.origin using error-prone string/regex matching or manual URL concatenation; use Origin.from() with isSameOrigin() or isSameSite() instead.',
          });
        }
      });
    }

    return matches;
  },
};

export const validateOriginsRule: AnalyzerRule = {
  id: 'validate-origins',
  guideId: 'validate-origins',
  guideHash: VALIDATE_ORIGINS_GUIDE_HASH,
  summary:
    'Validate MessageEvent origins using the structured Origin API (Origin.from(), isSameOrigin(), isSameSite()) instead of fragile startsWith/includes/endsWith/regex checks or manual location string concatenation.',
  matcher: validateOriginsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A cross-document message event listener validates event.origin using substring, prefix, suffix, or regular expression matching (such as startsWith, includes, endsWith, indexOf, match, or RegExp.test) or manual protocol + host string concatenation.',
      'Replacing the string/regex check with Origin.from(event).isSameOrigin(...) or isSameSite(...) eliminates prefix/subdomain spoofing, port normalization bugs, and Public Suffix List errors.',
    ],
    dropWhen: [
      'event.origin is checked against a fixed, port-normalized string literal (e.g. event.origin === "https://app.example.com") or an array allowlist of exact origin literals (e.g. allowedOrigins.includes(event.origin)).',
      'The code already feature-detects "Origin" in globalThis and falls back to URL parsing.',
      'The string operation is inspecting event.data or a non-origin string rather than event.origin.',
    ],
  },
};

export default [
  validateOriginsRule,
] satisfies readonly AnalyzerRule[];
