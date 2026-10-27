import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
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

export const SANITIZE_UNTRUSTED_HTML_GUIDE_HASH = '5ce9f1fd24c2';

const SANITIZER_FEATURE_TOKENS = [
  'setHTML',
  'Sanitizer',
  'setHTMLUnsafe',
  'parseHTML',
  'parseHTMLUnsafe',
] as const;

/**
 * Checks whether an expression is a call to a third-party sanitizer like
 * DOMPurify.sanitize(...), sanitizeHtml(...), xss(...), or insane(...).
 */
function isSanitizerCall(expr: Node): boolean {
  const unwrapped = unwrapExpression(expr);
  if (!Node.isCallExpression(unwrapped)) {
    return false;
  }
  const callee = unwrapExpression(unwrapped.getExpression());
  if (Node.isIdentifier(callee)) {
    const name = callee.getText();
    return name === 'sanitizeHtml' || name === 'xss' || name === 'insane';
  }
  if (Node.isPropertyAccessExpression(callee)) {
    const propName = callee.getName();
    if (propName === 'sanitize') {
      const obj = unwrapExpression(callee.getExpression());
      const objText = obj.getText();
      return (
        objText === 'DOMPurify' ||
        objText === 'dompurify' ||
        objText === 'window.DOMPurify' ||
        objText === 'globalThis.DOMPurify' ||
        /purify/i.test(objText)
      );
    }
  }
  return false;
}

/**
 * Resolves local identifiers to check if the value derives from a sanitizer call.
 */
function resolvesToSanitizerCall(node: Node): boolean {
  if (isSanitizerCall(node)) {
    return true;
  }
  const resolved = resolveLocalExpression(node);
  return isSanitizerCall(resolved);
}

/**
 * Checks whether a binary expression is an assignment to innerHTML or outerHTML
 * receiving a sanitized string value.
 */
function matchHtmlPropertyAssignment(binaryExpr: BinaryExpression): AnalyzerMatch | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }

  const left = unwrapExpression(binaryExpr.getLeft());
  if (!Node.isPropertyAccessExpression(left)) {
    return null;
  }

  const propName = left.getName();
  if (propName !== 'innerHTML' && propName !== 'outerHTML') {
    return null;
  }

  const right = unwrapExpression(binaryExpr.getRight());
  if (!resolvesToSanitizerCall(right)) {
    return null;
  }

  return {
    line: binaryExpr.getStartLineNumber(),
    message:
      `Assignment to .${propName} with third-party sanitizer output can be replaced with native Element.prototype.setHTML() and Sanitizer API.`,
  };
}

/**
 * Checks whether a call expression is a DOM insertion sink receiving sanitized HTML,
 * such as insertAdjacentHTML or $(...).html().
 */
function matchDomInsertionSink(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  const args = callExpr.getArguments();

  if (methodName === 'insertAdjacentHTML' && args.length >= 2) {
    const htmlArg = args[1];
    if (htmlArg && resolvesToSanitizerCall(htmlArg)) {
      return {
        line: callExpr.getStartLineNumber(),
        message:
          'Method insertAdjacentHTML(...) with third-party sanitizer output can be modernized with native Element.prototype.setHTML() and Sanitizer API.',
      };
    }
  }

  if (methodName === 'html' && args.length >= 1) {
    const htmlArg = args[0];
    if (htmlArg && resolvesToSanitizerCall(htmlArg)) {
      return {
        line: callExpr.getStartLineNumber(),
        message:
          'jQuery .html(...) with third-party sanitizer output can be replaced with native Element.prototype.setHTML() and Sanitizer API.',
      };
    }
  }

  return null;
}

export const sanitizerJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['DOMPurify', 'sanitize', 'sanitizeHtml', 'xss', 'insane'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    const recordMatch = (match: AnalyzerMatch | null): void => {
      if (!match) {
        return;
      }
      if (visitedLines.has(match.line)) {
        return;
      }
      visitedLines.add(match.line);
      matches.push(match);
    };

    sourceFile.forEachDescendant((node) => {
      if (Node.isBinaryExpression(node)) {
        const match = matchHtmlPropertyAssignment(node);
        if (match && !isProtectedByFeatureGuard(node, SANITIZER_FEATURE_TOKENS)) {
          recordMatch(match);
        }
        return;
      }

      if (Node.isCallExpression(node)) {
        const match = matchDomInsertionSink(node);
        if (match && !isProtectedByFeatureGuard(node, SANITIZER_FEATURE_TOKENS)) {
          recordMatch(match);
        }
      }
    });

    return matches;
  },
};

export const sanitizeUntrustedHtmlJsRule: AnalyzerRule = {
  id: 'sanitize-untrusted-html/js-dompurify-innerhtml',
  guideId: 'sanitize-untrusted-html',
  guideHash: SANITIZE_UNTRUSTED_HTML_GUIDE_HASH,
  summary:
    'Sanitized untrusted markup assigned to DOM insertion sinks (.innerHTML = DOMPurify.sanitize(...)) can be modernized with native setHTML().',
  matcher: sanitizerJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Assigning sanitized untrusted markup to DOM insertion sinks via element.innerHTML = DOMPurify.sanitize(...) or insertAdjacentHTML.',
    ],
    dropWhen: [
      'Code already utilizing native Element.prototype.setHTML() or Document.parseHTML() with Sanitizer configurations.',
      'Guarded by feature detection checks verifying "setHTML" in Element.prototype or typeof Sanitizer !== "undefined".',
      'React or JSX components using dangerouslySetInnerHTML={{ __html: ... }}, where React virtual DOM does not support native setHTML() without ref-based DOM manipulation.',
      'Server-side HTML sanitization pipelines in Node.js, CLI scripts, backend build tools, or SSR middleware where browser DOM Sanitizer API is not available.',
    ],
  },
};

export default [
  sanitizeUntrustedHtmlJsRule,
] satisfies readonly AnalyzerRule[];
