import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
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

export const INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH = '332c95d0cbc9';

const INTEREST_GUARD_TOKENS = [
  'interestfor',
  'interesttarget',
  'popover',
] as const;

const NON_SIMPLE_TIPPY_OPTION_KEYS: ReadonlySet<string> = new Set([
  'followCursor',
  'allowHTML',
  'onShow',
  'onShown',
  'onTrigger',
  'onUntrigger',
  'onCreate',
  'onMount',
  'onHide',
  'onHidden',
  'onClickOutside',
  'popperOptions',
  'plugins',
  'sticky',
  'inlinePositioning',
  'appendTo',
  'render',
]);

function isInteractiveOrClickPopoverConfig(optionsObj: ObjectLiteralExpression): boolean {
  for (const prop of optionsObj.getProperties()) {
    if (
      Node.isPropertyAssignment(prop) ||
      Node.isShorthandPropertyAssignment(prop) ||
      Node.isMethodDeclaration(prop)
    ) {
      const name = prop.getName();
      if (NON_SIMPLE_TIPPY_OPTION_KEYS.has(name)) {
        if (Node.isPropertyAssignment(prop)) {
          const init = prop.getInitializer();
          if (init && unwrapExpression(init).getKind() === SyntaxKind.FalseKeyword) {
            continue;
          }
        }
        return true;
      }
      if (name === 'interactive') {
        if (Node.isShorthandPropertyAssignment(prop)) {
          return true;
        }
        if (Node.isPropertyAssignment(prop)) {
          const init = prop.getInitializer();
          if (init && unwrapExpression(init).getKind() !== SyntaxKind.FalseKeyword) {
            return true;
          }
        }
      }
      if (name === 'content') {
        if (Node.isMethodDeclaration(prop)) {
          return true;
        }
        if (Node.isPropertyAssignment(prop)) {
          const init = prop.getInitializer();
          if (init) {
            const resolvedContent = resolveLocalExpression(init, 2);
            if (
              Node.isArrowFunction(resolvedContent) ||
              Node.isFunctionExpression(resolvedContent)
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  const triggerProp = optionsObj.getProperty('trigger');
  if (triggerProp && Node.isPropertyAssignment(triggerProp)) {
    const init = triggerProp.getInitializer();
    if (init) {
      const unwrapped = unwrapExpression(init);
      if (Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)) {
        const triggerText = unwrapped.getLiteralText();
        if (triggerText.includes('click') || triggerText.includes('manual')) {
          return true;
        }
      }
    }
  }

  return false;
}

function matchTippyCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length === 0 || !args[0]) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!isLibraryReference(callee, 'tippy', ['tippy.js', '@tippyjs/react'])) {
    return null;
  }

  const targetNode = resolveLocalExpression(args[0], 2);
  if (Node.isObjectLiteralExpression(targetNode)) {
    return null;
  }

  if (args[1]) {
    const optionsNode = resolveLocalExpression(args[1], 2);
    if (
      Node.isObjectLiteralExpression(optionsNode) &&
      isInteractiveOrClickPopoverConfig(optionsNode)
    ) {
      return null;
    }
  }

  return 'tippy() hover tooltip initialization can be modernized with declarative HTML interestfor / interesttarget, popover="hint", and CSS Anchor Positioning.';
}

function isGuardedByInterestCheck(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, INTEREST_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        INTEREST_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

export const interestTriggeredTooltipsJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['tippy'],
  isGuarded: (node) => isGuardedByInterestCheck(node),
  matchCall: (node) => matchTippyCall(node),
});

export const interestTriggeredTooltipsJsRule: AnalyzerRule = {
  id: 'interest-triggered-tooltips/js-tooltip',
  guideId: 'interest-triggered-tooltips',
  guideHash: INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH,
  summary:
    'JavaScript tippy() hover tooltip calls should be modernized with declarative HTML interestfor, popover="hint", and CSS Anchor Positioning.',
  matcher: interestTriggeredTooltipsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls tippy(target, options) to attach hover/focus tooltips without interactive click menus.',
      'Custom mouseenter hover delay timeouts position tooltip div elements.',
    ],
    dropWhen: [
      'The tippy() instance configures interactive: true or trigger: "click" for interactive menus or forms.',
      'The code uses native HTML title attributes, static pure-CSS [data-tooltip]::after tooltips, or is guarded by an interestfor / interesttarget check.',
    ],
  },
};

export default [
  interestTriggeredTooltipsJsRule,
] satisfies readonly AnalyzerRule[];
