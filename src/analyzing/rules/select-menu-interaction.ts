import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isDomClassOrAttrMutation,
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveLocalExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SELECT_MENU_INTERACTION_GUIDE_HASH = '3d0aae1e8d74';

const SELECT_INVALID_SELECTOR_REGEX =
  /(?:^|[\s>+~,])select(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*:invalid\b/i;

const USER_INVALID_GUARD_TOKENS = [
  ':user-invalid',
  'user-invalid',
] as const;

const SELECT_IDENTIFIER_REGEX =
  /(?:^|[^a-zA-Z])select(?:El|Element|Menu|Box|Input|Field|Dropdown|s)?(?![a-zA-Z])/i;

function isSelectTargetText(text: string): boolean {
  if (/\[[^\]]*\bmultiple\b[^\]]*\]/i.test(text)) {
    return false;
  }
  const stripped = text.replace(/\bquerySelector(?:All)?\b/g, '');
  return (
    /\bselect\b/i.test(stripped) ||
    SELECT_IDENTIFIER_REGEX.test(stripped)
  );
}

function isSelectTargetNode(targetNode: Node | undefined): boolean {
  if (!targetNode) {
    return false;
  }
  const directText = targetNode.getText();
  const resolved = resolveLocalExpression(targetNode, 2);
  const resolvedText = resolved.getText();
  if (
    /\[[^\]]*\bmultiple\b[^\]]*\]/i.test(directText) ||
    /\[[^\]]*\bmultiple\b[^\]]*\]/i.test(resolvedText)
  ) {
    return false;
  }
  if (isSelectTargetText(directText)) {
    return true;
  }
  return isSelectTargetText(resolvedText);
}

function matchSelectValidationListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['blur', 'change']);
  if (!listener) {
    return null;
  }

  if (!isSelectTargetNode(listener.targetNode)) {
    return null;
  }

  if (!isDomClassOrAttrMutation(listener.handlerNode)) {
    return null;
  }

  const handlerText = listener.handlerNode.getText();
  const checksEmptyOrInvalid =
    /\.value\s*===\s*['"`]{2}|!\s*[a-zA-Z0-9_$.]+\.value\b|checkValidity\s*\(|validity\.valid/.test(
      handlerText,
    );
  const togglesErrorState =
    /invalid|error|touched|dirty/i.test(handlerText);

  if (!checksEmptyOrInvalid || !togglesErrorState) {
    return null;
  }

  return `Imperative '${listener.eventName}' listener toggling invalid/error state on <select> can be modernized with native <select required> and CSS select:user-invalid.`;
}

export const selectMenuInteractionCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [':invalid'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    const selector = styleRule.selectorText;
    if (
      selector.includes(':user-invalid') ||
      ctx.stylesheetText.includes(':user-invalid')
    ) {
      return null;
    }

    if (
      styleRule.parentAtRule &&
      styleRule.parentAtRule.includes(':user-invalid')
    ) {
      return null;
    }

    const selectorWithoutNot = selector.replace(/:not\([^)]*\)/gi, '');
    if (!SELECT_INVALID_SELECTOR_REGEX.test(selectorWithoutNot)) {
      return null;
    }

    return {
      message:
        'CSS selector uses select:invalid which styles required <select> menus as invalid before user interaction; modernize with select:user-invalid.',
    };
  },
};

export const selectMenuInteractionJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['blur', 'change'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, USER_INVALID_GUARD_TOKENS)) {
        return;
      }

      const msg = matchSelectValidationListener(node);
      if (msg) {
        matches.push({
          line: node.getStartLineNumber(),
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const selectMenuInteractionCssRule: AnalyzerRule = {
  id: 'select-menu-interaction/css-select-invalid',
  guideId: 'select-menu-interaction',
  guideHash: SELECT_MENU_INTERACTION_GUIDE_HASH,
  summary:
    'CSS select:invalid selectors without :user-invalid should be modernized with select:user-invalid so required dropdowns only show error styles after interaction.',
  matcher: selectMenuInteractionCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule uses select:invalid without :user-invalid to apply error styling to a required <select> menu.',
    ],
    dropWhen: [
      'The stylesheet already uses select:user-invalid or guards select:invalid inside @supports not selector(:user-invalid).',
      'The code styles multi-select inputs or async server-side validation responses.',
    ],
  },
};

export const selectMenuInteractionJsRule: AnalyzerRule = {
  id: 'select-menu-interaction/js-select-interaction',
  guideId: 'select-menu-interaction',
  guideHash: SELECT_MENU_INTERACTION_GUIDE_HASH,
  summary:
    'JavaScript blur/change listeners checking select.value === "" to toggle invalid classes should be modernized with CSS select:user-invalid and <select required>.',
  matcher: selectMenuInteractionJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A change or blur event listener on a <select> element checks select.value === "" or !select.value and toggles an invalid, error, or touched class or aria-invalid attribute.',
    ],
    dropWhen: [
      'The listener is guarded by a CSS.supports("selector(:user-invalid)") check.',
      'The handler processes multi-select inputs or asynchronous server-side validation responses.',
    ],
  },
};

export const selectMenuInteractionRules: readonly AnalyzerRule[] = [
  selectMenuInteractionCssRule,
  selectMenuInteractionJsRule,
];
