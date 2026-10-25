import {
  Node,
  type CallExpression,
  type FunctionExpression,
  type ArrowFunction,
  type MethodDeclaration,
  type FunctionDeclaration,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const RESILIENT_CONTEXT_MENUS_GUIDE_HASH = '9152c0b12710';

const FEATURE_GUARD_TOKENS = [
  'anchor-name',
  'anchorName',
  'position-anchor',
  'positionAnchor',
  'position-area',
  'positionArea',
  'position-try-fallbacks',
  'positionTryFallbacks',
  'popover',
] as const;

const CONTEXT_MENU_KEYWORDS = [
  'menu',
  'dropdown',
  'popover',
  'contextmenu',
  'context-menu',
  'action-panel',
  'popup',
] as const;

function isDropdownOrMenuContext(text: string): boolean {
  const lower = text.toLowerCase();
  return CONTEXT_MENU_KEYWORDS.some((kw) => lower.includes(kw));
}

function isJqueryDropdownCall(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const methodName = expr.getName();
  if (methodName !== 'dropdown') {
    return false;
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return true;
  }
  const firstArg = unwrapExpression(args[0] as Node);
  if (Node.isStringLiteral(firstArg)) {
    const val = firstArg.getLiteralText().toLowerCase();
    return val === 'toggle' || val === 'show' || val === 'hide';
  }
  return false;
}

function isPopperCallOrInstantiation(node: CallExpression | NewExpression): boolean {
  if (Node.isNewExpression(node)) {
    const expr = unwrapExpression(node.getExpression());
    const name = expr.getText();
    return name === 'Popper' || name === 'PopperJS' || name.endsWith('.Popper');
  }

  const expr = unwrapExpression(node.getExpression());
  if (Node.isPropertyAccessExpression(expr)) {
    const name = expr.getName();
    if (name === 'createPopper') {
      return true;
    }
  } else if (Node.isIdentifier(expr)) {
    const name = expr.getText();
    if (name === 'createPopper' || name === 'computePosition') {
      return true;
    }
  }
  return false;
}

type CallableNode =
  | FunctionDeclaration
  | FunctionExpression
  | ArrowFunction
  | MethodDeclaration;

function isCallable(node: Node): node is CallableNode {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isFunctionExpression(node) ||
    Node.isArrowFunction(node) ||
    Node.isMethodDeclaration(node)
  );
}

function isManualCoordinateClamping(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  if (expr.getName() !== 'getBoundingClientRect') {
    return false;
  }

  let scope: Node | undefined = call.getParent();
  while (scope && !isCallable(scope) && !Node.isSourceFile(scope)) {
    scope = scope.getParent();
  }

  if (!scope || !isCallable(scope)) {
    return false;
  }

  const scopeText = scope.getText();
  if (!isDropdownOrMenuContext(scopeText)) {
    return false;
  }

  const assignsPosition =
    scopeText.includes('.style.top') ||
    scopeText.includes('.style.left') ||
    scopeText.includes('.style.cssText') ||
    scopeText.includes("style['top']") ||
    scopeText.includes("style['left']");

  const performsClamping =
    scopeText.includes('innerWidth') ||
    scopeText.includes('innerHeight') ||
    scopeText.includes('clientX') ||
    scopeText.includes('clientY') ||
    scopeText.includes('Math.min') ||
    scopeText.includes('Math.max') ||
    scopeText.includes('flip');

  return assignsPosition && performsClamping;
}

const resilientContextMenusDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: '[data-toggle="dropdown"], [data-bs-toggle="dropdown"]',
  fastTokens: ['data-toggle', 'data-bs-toggle', 'dropdown'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['popovertarget', 'commandfor', 'command'],
  matchElement: (element: DomElementView, _ctx: DomMatcherContext) => {
    if (
      element.hasAttribute('popovertarget') ||
      element.hasAttribute('commandfor') ||
      element.hasAttribute('command')
    ) {
      return null;
    }

    const toggle = (
      element.getAttribute('data-toggle') ??
      element.getAttribute('data-bs-toggle') ??
      ''
    ).toLowerCase();

    if (toggle === 'dropdown') {
      return {
        message:
          'Legacy dropdown trigger uses data-toggle="dropdown" or data-bs-toggle="dropdown"; modernize with native popover and CSS Anchor Positioning (position-anchor, position-area).',
      };
    }

    return null;
  },
};

const resilientContextMenusJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    '.dropdown(',
    'dropdown("',
    "dropdown('",
    'createPopper',
    'new Popper',
    'PopperJS',
    'computePosition',
    'getBoundingClientRect',
    'contextmenu',
  ],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        if (isJqueryDropdownCall(node)) {
          const line = node.getStartLineNumber();
          if (visitedLines.has(line)) return;
          if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) return;
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'Legacy jQuery .dropdown() call toggles overlay menu imperatively; modernize with native popover and CSS Anchor Positioning (position-area, position-try-fallbacks).',
          });
          return;
        }

        if (isPopperCallOrInstantiation(node)) {
          const scopeOrFile = (node.getParent()?.getText() ?? '') + ' ' + sourceFile.getFilePath();
          const hasMenuContext =
            /\b(?:dropdown|menu|contextmenu|context-menu|submenu)\b/i.test(
              scopeOrFile,
            ) ||
            /\b(?:dropdown|menu|contextmenu|context-menu|submenu)\b/i.test(
              sourceFile.getText(),
            );
          if (!hasMenuContext) {
            return;
          }

          const line = node.getStartLineNumber();
          if (visitedLines.has(line)) return;
          if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) return;
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'JavaScript positioning library (Popper.js / Floating UI) manages overlay coordinates; modernize with native popover and CSS Anchor Positioning (position-anchor, position-area).',
          });
          return;
        }

        if (isManualCoordinateClamping(node)) {
          const line = node.getStartLineNumber();
          if (visitedLines.has(line)) return;
          if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) return;
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'Manual getBoundingClientRect() coordinate clamping positions a menu or dropdown; replace with CSS Anchor Positioning (position-area, position-try-fallbacks).',
          });
          return;
        }
      } else if (Node.isNewExpression(node)) {
        if (isPopperCallOrInstantiation(node)) {
          const scopeOrFile = (node.getParent()?.getText() ?? '') + ' ' + sourceFile.getFilePath();
          const hasMenuContext =
            /\b(?:dropdown|menu|contextmenu|context-menu|submenu)\b/i.test(
              scopeOrFile,
            ) ||
            /\b(?:dropdown|menu|contextmenu|context-menu|submenu)\b/i.test(
              sourceFile.getText(),
            );
          if (!hasMenuContext) {
            return;
          }

          const line = node.getStartLineNumber();
          if (visitedLines.has(line)) return;
          if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) return;
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'Legacy Popper instantiation positions overlay tethered to an anchor; modernize with native popover and CSS Anchor Positioning (position-anchor, position-area).',
          });
        }
      }
    });

    return matches;
  },
};

export const resilientContextMenusAndNestedDropdownsRule: AnalyzerRule = {
  id: 'resilient-context-menus-and-nested-dropdowns',
  guideId: 'resilient-context-menus-and-nested-dropdowns',
  guideHash: RESILIENT_CONTEXT_MENUS_GUIDE_HASH,
  summary:
    'Legacy Bootstrap dropdown triggers should be modernized with native popover and CSS Anchor Positioning.',
  matcher: resilientContextMenusDomMatcher,
  verifierRubric: {
    keepWhen: [
      'An HTML or JSX element uses Bootstrap legacy data-toggle="dropdown" or data-bs-toggle="dropdown" to toggle a dropdown menu or contextual action list.',
      'A dropdown, menu, or context menu is positioned using Popper.js, Floating UI computePosition(), or jQuery .dropdown("toggle").',
      'JavaScript event handlers manually calculate clientX/clientY or getBoundingClientRect() coordinates with viewport boundary clamping to position a context menu or dropdown overlay.',
    ],
    dropWhen: [
      'The element or menu already uses native popover attributes (popover, popovertarget) or CSS Anchor Positioning (position-anchor, position-area).',
      'The positioning logic belongs to a custom canvas rendering pipeline, interactive drag-and-drop ghost element, or WebGL HUD rather than a DOM overlay menu.',
      'Popper or computePosition is used specifically for complex dynamic chart tooltips with continuous multi-axis coordinate tracking.',
    ],
  },
};

export const resilientContextMenusAndNestedDropdownsPositioningRule: AnalyzerRule = {
  id: 'resilient-context-menus-and-nested-dropdowns/positioning',
  guideId: 'resilient-context-menus-and-nested-dropdowns',
  guideHash: RESILIENT_CONTEXT_MENUS_GUIDE_HASH,
  summary:
    'Imperative dropdown/context-menu positioning via Popper.js, Floating UI, jQuery .dropdown(), or manual getBoundingClientRect clamping should be replaced with native popover and CSS Anchor Positioning.',
  matcher: resilientContextMenusJsMatcher,
  verifierRubric: resilientContextMenusAndNestedDropdownsRule.verifierRubric,
};

// Retired default array per O8 slice 3 audit and critical rules
export const resilientContextMenusAndNestedDropdownsRules: readonly AnalyzerRule[] = [];
