import {
  Node,
  SyntaxKind,
  type CallExpression,
} from 'ts-morph';
import {
  isGlobalReference,
  isLibraryReference,
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH = 'c3ad39a2b24e';

const HOVERINTENT_PACKAGES = [
  'hoverintent',
  'jquery-hoverintent',
] as const;

const INTEREST_PREVIEW_GUARD_TOKENS = [
  'interestForElement',
  'interestfor',
  'interesttarget',
  'InterestEvent',
  'loseinterest',
] as const;

const HOVER_EVENTS = [
  'mouseenter',
  'mouseover',
  'focusin',
] as const;

const PREVIEW_ACTION_REGEX =
  /\b(?:preview|hovercard|hoverCard|actionCard|quickview|quickView|popover|showPopover|togglePopover)\b|dataset\.preview|dataset\.effect/i;

function isGuardedByInterestInvoker(node: Node, fileContent: string): boolean {
  if (
    /\binterestfor\s*=/i.test(fileContent) ||
    /\binteresttarget\s*=/i.test(fileContent)
  ) {
    return true;
  }
  if (isProtectedByFeatureGuard(node, INTEREST_PREVIEW_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        INTEREST_PREVIEW_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function hasSetTimeoutWithPreviewContext(handlerNode: Node): boolean {
  const calls = handlerNode.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const callExpr of calls) {
    const callee = unwrapExpression(callExpr.getExpression());
    const isSetTimeout =
      isGlobalReference(callee, 'setTimeout') ||
      (Node.isPropertyAccessExpression(callee) &&
        callee.getName() === 'setTimeout' &&
        isGlobalReference(callee.getExpression(), 'window'));
    if (!isSetTimeout) {
      continue;
    }
    const callbackArg = callExpr.getArguments()[0];
    if (!callbackArg) {
      continue;
    }
    const resolvedCallback = resolveCallableNode(callbackArg, 2);
    if (
      PREVIEW_ACTION_REGEX.test(resolvedCallback.getText()) ||
      PREVIEW_ACTION_REGEX.test(handlerNode.getText())
    ) {
      return true;
    }
  }
  return false;
}

function matchHoverPreviewCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  const callee = unwrapExpression(callExpr.getExpression());

  if (
    args.length >= 2 &&
    (isLibraryReference(callee, 'hoverintent', HOVERINTENT_PACKAGES) ||
      isLibraryReference(callee, 'hoverIntent', HOVERINTENT_PACKAGES))
  ) {
    return 'hoverintent() hover-intent listener can be modernized with declarative HTML interestfor and interest / loseinterest events.';
  }

  if (
    args.length >= 1 &&
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === 'hoverIntent'
  ) {
    return 'jQuery .hoverIntent() listener can be modernized with declarative HTML interestfor and interest / loseinterest events.';
  }

  const matchedListener = matchEventListenerCall(callExpr, HOVER_EVENTS);
  if (matchedListener && hasSetTimeoutWithPreviewContext(matchedListener.handlerNode)) {
    return `Manual ${matchedListener.eventName} + setTimeout hover-intent preview delay can be modernized with declarative HTML interestfor, interest-delay, and interest / loseinterest events.`;
  }

  return null;
}

export const interestTriggeredActionPreviewsPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    HOVERINTENT_PACKAGES,
    (pkgName, versionRange) =>
      `Hover-intent dependency "${pkgName}" (${versionRange}) can be modernized with declarative HTML interestfor, interest-delay, and interest / loseinterest events.`,
  );

export const interestTriggeredActionPreviewsJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    ['hoverintent', 'hoverIntent', 'mouseenter', 'mouseover', 'focusin'],
    ['hoverintent', 'hoverIntent', 'setTimeout'],
    [
      'hoverintent',
      'hoverIntent',
      'preview',
      'Preview',
      'hovercard',
      'hoverCard',
      'HoverCard',
      'actionCard',
      'ActionCard',
      'quickview',
      'quickView',
      'QuickView',
      'popover',
      'Popover',
      'dataset.effect',
    ],
  ],
  dedupeLines: true,
  isGuarded: (node, _sourceFile, ctx) => isGuardedByInterestInvoker(node, ctx.fileContent),
  matchCall: (node) => matchHoverPreviewCall(node),
});

export const interestTriggeredActionPreviewsPackageRule: AnalyzerRule = {
  id: 'interest-triggered-action-previews/package-hoverintent',
  guideId: 'interest-triggered-action-previews',
  guideHash: INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH,
  summary:
    'Hover-intent dependencies (hoverintent, jquery-hoverintent) for triggering action previews can be modernized with HTML interestfor and interest / loseinterest events.',
  matcher: interestTriggeredActionPreviewsPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares hoverintent or jquery-hoverintent in package.json dependencies to trigger action previews or hovercards after a hover delay.',
    ],
    dropWhen: [
      'Pure CSS :hover style transitions without delayed preview cards or popovers.',
      'Click-triggered dropdown menus or navigation menus unrelated to interest-triggered action previews.',
    ],
  },
};

export const interestTriggeredActionPreviewsJsRule: AnalyzerRule = {
  id: 'interest-triggered-action-previews/js-hover-preview',
  guideId: 'interest-triggered-action-previews',
  guideHash: INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH,
  summary:
    'JavaScript hoverintent(), .hoverIntent(), and mouseenter/focusin + setTimeout hover-intent delays triggering action previews should be modernized with HTML interestfor.',
  matcher: interestTriggeredActionPreviewsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript uses hoverintent() or $(...).hoverIntent() to trigger a preview card, popover, or action preview effect.',
      'Manual mouseenter/mouseleave or focusin debounce timers (setTimeout) trigger action preview popovers or preview dataset states.',
    ],
    dropWhen: [
      'The code is guarded by an "interestForElement" in HTMLButtonElement.prototype, interestfor, or interesttarget feature check.',
      'Pure CSS :hover style transitions or immediate mouseenter analytics tracking without action preview UI.',
      'Click-triggered dropdown menus or modal dialogs.',
    ],
  },
};

export default [
  interestTriggeredActionPreviewsPackageRule,
  interestTriggeredActionPreviewsJsRule,
] satisfies readonly AnalyzerRule[];
