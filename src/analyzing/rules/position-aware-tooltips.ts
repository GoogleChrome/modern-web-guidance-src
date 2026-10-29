import {
  Node,
  SyntaxKind,
  type CallExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const POSITION_AWARE_TOOLTIPS_GUIDE_HASH = '9081ca694c81';

const ANCHOR_GUARD_TOKENS = [
  'anchor-name',
  'anchorName',
  'position-anchor',
  'positionAnchor',
  'position-try-fallbacks',
  'positionTryFallbacks',
  'container-type',
] as const;

const TOOLTIP_CONTEXT_REGEX = /tooltip|role\s*=\s*['"]tooltip['"]/i;

const NON_TOOLTIP_WIDGET_REGEX =
  /\b(?:dropdown|combobox|listbox|menu|menubar|menuitem|contextmenu|modal|dialog|select|datepicker|autocomplete)\b/i;

const POSITIONING_GLOBAL_NAMESPACES = {
  globalNamespaces: ['Popper', 'FloatingUIDOM'],
} as const;

function hasTooltipContext(callExpr: CallExpression): boolean {
  let hasNonTooltipWidgetArg = false;
  for (const arg of callExpr.getArguments()) {
    const argText = arg.getText();
    const resolvedText = resolveLocalExpression(arg, 2).getText();
    if (
      NON_TOOLTIP_WIDGET_REGEX.test(argText) ||
      NON_TOOLTIP_WIDGET_REGEX.test(resolvedText)
    ) {
      hasNonTooltipWidgetArg = true;
    } else if (
      TOOLTIP_CONTEXT_REGEX.test(argText) ||
      TOOLTIP_CONTEXT_REGEX.test(resolvedText)
    ) {
      return true;
    }
  }

  if (hasNonTooltipWidgetArg) {
    return false;
  }

  let current: Node | undefined = callExpr.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isVariableDeclaration(current) ||
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isPropertyAssignment(current) ||
      Node.isClassDeclaration(current)
    ) {
      const nameText = current.getName() ?? '';
      if (NON_TOOLTIP_WIDGET_REGEX.test(nameText)) {
        return false;
      }
      if (TOOLTIP_CONTEXT_REGEX.test(nameText)) {
        return true;
      }
    }
    current = current.getParent();
  }

  return false;
}

function isGuardedByAnchorSupport(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, ANCHOR_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        ANCHOR_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
        current.getExpression().getDescendantsOfKind(SyntaxKind.ExclamationToken).length > 0 &&
        node.getStart() >= current.getThenStatement().getStart() &&
        node.getEnd() <= current.getThenStatement().getEnd()
      ) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchPopperTooltipCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length < 3) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  const isPopper = isLibraryReference(
    callee,
    'createPopper',
    ['@popperjs/core', 'popper.js'],
    POSITIONING_GLOBAL_NAMESPACES,
  );
  const isFloatingUi = isLibraryReference(
    callee,
    'computePosition',
    ['@floating-ui/dom', '@floating-ui/core'],
    POSITIONING_GLOBAL_NAMESPACES,
  );

  if (!isPopper && !isFloatingUi) {
    return null;
  }

  if (!hasTooltipContext(callExpr)) {
    return null;
  }

  const sfText = callExpr.getSourceFile().getFullText();
  const scope =
    callExpr.getFirstAncestor((a) => Node.isFunctionLikeDeclaration(a)) ??
    callExpr.getSourceFile();
  if (
    !TOOLTIP_CONTEXT_REGEX.test(callExpr.getText()) &&
    !/\barrow\b/i.test(sfText)
  ) {
    return null;
  }
  if (
    !/\b(?:arrow|fallbackPlacements)\b/i.test(scope.getText()) &&
    /\b(?:shadowRoot|Teleport|useRef)\b/.test(sfText)
  ) {
    return null;
  }

  const apiName = isPopper ? 'createPopper()' : 'computePosition()';
  return `JavaScript ${apiName} tooltip positioning can be modernized with CSS Anchor Positioning, position-try-fallbacks, and @container anchored(fallback: ...).`;
}

export const positionAwareTooltipsJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['createPopper', 'computePosition'],
  matchCall: (node) => {
    const msg = matchPopperTooltipCall(node);
    return msg && !isGuardedByAnchorSupport(node) ? msg : null;
  },
});

export const positionAwareTooltipsJsRule: AnalyzerRule = {
  id: 'position-aware-tooltips/js-popper-tooltip',
  guideId: 'position-aware-tooltips',
  guideHash: POSITION_AWARE_TOOLTIPS_GUIDE_HASH,
  summary:
    'JavaScript createPopper() and computePosition() calls positioning tooltip elements should be modernized with CSS Anchor Positioning, position-try-fallbacks, and @container anchored(fallback: ...).',
  matcher: positionAwareTooltipsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls createPopper() or computePosition() to position a tooltip element (with flip() middleware or viewport boundary adjustments).',
      'Custom JS viewport collision detection flips tooltip placement classes when overflowing the viewport.',
    ],
    dropWhen: [
      'The call is guarded by CSS.supports("anchor-name", "--a") or CSS.supports("position-anchor", "--a").',
      'Pure CSS static margin tooltips or fixed screen-center modal positioning.',
      'createPopper() or computePosition() is positioning a context menu or dropdown menu rather than a tooltip.',
    ],
  },
};

export default [
  positionAwareTooltipsJsRule,
] satisfies readonly AnalyzerRule[];
