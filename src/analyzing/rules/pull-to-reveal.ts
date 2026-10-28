import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const PULL_TO_REVEAL_GUIDE_HASH = 'f9c09a067f0a';

const PULL_TO_REVEAL_FAST_TOKENS = [
  'scrollTop',
  'offsetHeight',
  'clientHeight',
] as const;

const PULL_TO_REVEAL_GUARD_TOKENS = [
  'scroll-initial-target',
  'scrollInitialTarget',
] as const;

const TOP_REVEAL_ELEMENT_NAME_REGEX =
  /(?:search|header|reveal|toolbar|filter|banner|drawer|pull|top[-_]?bar|action[-_]?bar)/i;

const INTERACTIVE_EVENT_NAMES: ReadonlySet<string> = new Set([
  'scroll',
  'touchstart',
  'touchmove',
  'touchend',
  'pointerdown',
  'pointermove',
  'pointerup',
  'mousedown',
  'mousemove',
  'mouseup',
  'wheel',
  'click',
  'dblclick',
  'keydown',
  'keyup',
  'input',
  'change',
  'submit',
  'resize',
]);

function isTopRevealHeightExpression(exprNode: Node): boolean {
  const resolved = unwrapExpression(resolveLocalExpression(exprNode, 2));
  const text = resolved.getText();

  const readsElementHeight =
    /\.(?:offsetHeight|clientHeight)\b/.test(text) ||
    /\.getBoundingClientRect\s*\(\s*\)\s*\.height\b/.test(text);

  if (!readsElementHeight) {
    return false;
  }

  let receiverResolvedText = '';
  if (Node.isPropertyAccessExpression(resolved)) {
    const recv = unwrapExpression(resolved.getExpression());
    receiverResolvedText = resolveLocalExpression(recv, 2).getText();
  }

  return (
    TOP_REVEAL_ELEMENT_NAME_REGEX.test(text) ||
    TOP_REVEAL_ELEMENT_NAME_REGEX.test(exprNode.getText()) ||
    TOP_REVEAL_ELEMENT_NAME_REGEX.test(receiverResolvedText)
  );
}

function isInsideInteractiveOrDomLoadListener(
  node: Node,
  disallowDomContentLoadedForScrollTo: boolean,
): boolean {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isCallExpression(current)) {
      const callee = unwrapExpression(current.getExpression());
      if (Node.isPropertyAccessExpression(callee)) {
        const method = callee.getName();
        if (method === 'addEventListener' || method === 'on' || method === 'bind') {
          const firstArg = current.getArguments()[0];
          if (firstArg) {
            const unwrapped = unwrapExpression(firstArg);
            if (
              Node.isStringLiteral(unwrapped) ||
              Node.isNoSubstitutionTemplateLiteral(unwrapped)
            ) {
              const evName = unwrapped.getLiteralText().trim();
              if (INTERACTIVE_EVENT_NAMES.has(evName.toLowerCase())) {
                return true;
              }
              if (
                disallowDomContentLoadedForScrollTo &&
                (evName === 'DOMContentLoaded' || evName === 'load')
              ) {
                return true;
              }
            }
          }
        }
      }
    } else if (Node.isBinaryExpression(current)) {
      if (current.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
        const leftText = current.getLeft().getText();
        if (/\.(?:onscroll|ontouchmove|onmousemove|onclick|onwheel|onresize)$/i.test(leftText)) {
          return true;
        }
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchScrollTopRevealAssignment(binExpr: BinaryExpression): string | null {
  if (binExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }

  const left = unwrapExpression(binExpr.getLeft());
  if (!Node.isPropertyAccessExpression(left) || left.getName() !== 'scrollTop') {
    return null;
  }

  if (!isTopRevealHeightExpression(binExpr.getRight())) {
    return null;
  }

  if (isInsideInteractiveOrDomLoadListener(binExpr, false)) {
    return null;
  }

  return 'Setting container.scrollTop to the height of a top reveal element on load can be replaced with CSS scroll-initial-target: nearest and scroll-snap-type: y mandatory.';
}

function matchScrollToRevealCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  const isScrollTo =
    (Node.isPropertyAccessExpression(callee) && callee.getName() === 'scrollTo') ||
    (Node.isIdentifier(callee) && callee.getText() === 'scrollTo');

  if (!isScrollTo) {
    return null;
  }

  // Carve out DOMContentLoaded / load listeners calling scrollTo (owned by scroll-target-on-load)
  if (isInsideInteractiveOrDomLoadListener(callExpr, true)) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  // Case 1: scrollTo(0, headerEl.offsetHeight)
  if (args.length >= 2 && args[0] && args[1]) {
    const firstArg = unwrapExpression(args[0]);
    if (Node.isNumericLiteral(firstArg) && firstArg.getLiteralValue() === 0) {
      if (isTopRevealHeightExpression(args[1])) {
        return 'Initial scrollTo(0, header.offsetHeight) hiding a top reveal element can be replaced with CSS scroll-initial-target: nearest and scroll-snap-type: y mandatory.';
      }
    }
  }

  // Case 2: scrollTo({ top: headerEl.offsetHeight })
  if (args[0]) {
    const firstArg = unwrapExpression(args[0]);
    if (Node.isObjectLiteralExpression(firstArg)) {
      const topProp = firstArg.getProperty('top');
      if (topProp && Node.isPropertyAssignment(topProp)) {
        const init = topProp.getInitializer();
        if (init && isTopRevealHeightExpression(init)) {
          return 'Initial scrollTo({ top: header.offsetHeight }) hiding a top reveal element can be replaced with CSS scroll-initial-target: nearest and scroll-snap-type: y mandatory.';
        }
      }
    }
  }

  return null;
}

export const pullToRevealJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: PULL_TO_REVEAL_FAST_TOKENS,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    for (const guard of PULL_TO_REVEAL_GUARD_TOKENS) {
      if (ctx.fileContent.includes(guard)) {
        return [];
      }
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const binExpr of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      const message = matchScrollTopRevealAssignment(binExpr);
      if (message !== null) {
        const line = binExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const message = matchScrollToRevealCall(callExpr);
      if (message !== null) {
        const line = callExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    return matches;
  },
};

export const pullToRevealRule: AnalyzerRule = {
  id: 'pull-to-reveal',
  guideId: 'pull-to-reveal',
  guideHash: PULL_TO_REVEAL_GUIDE_HASH,
  summary:
    'Initial scroll-offset assignments (container.scrollTop = searchBar.offsetHeight or scrollTo({ top: header.offsetHeight })) that hide a top reveal element on load can be replaced with CSS scroll-initial-target: nearest and scroll-snap-type: y mandatory.',
  matcher: pullToRevealJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript sets container.scrollTop = headerEl.offsetHeight / clientHeight (or scrollTo({ top: headerEl.offsetHeight })) on initial load or mount to start scrolled past a top reveal element such as a search bar, filter bar, or header.',
    ],
    dropWhen: [
      'The code already uses CSS scroll-initial-target: nearest or is a CSS.supports("scroll-initial-target", "nearest") progressive enhancement fallback.',
      'The scrollTop assignment is a general scroll restoration, chat bottom-pinning (scrollTop = scrollHeight), or interactive scroll handler rather than hiding a top reveal element on load.',
      'The code is a DOMContentLoaded / load listener calling scrollIntoView() on a general content target (covered by scroll-target-on-load).',
    ],
  },
};

export default [
  pullToRevealRule,
] satisfies readonly AnalyzerRule[];
