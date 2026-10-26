import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isDomClassOrAttrMutation,
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
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

export const REQUIRED_FIELD_FEEDBACK_GUIDE_HASH = '7772788421b6';

const REQUIRED_INVALID_SELECTOR_REGEX =
  /(?:^|[\s>+~,])(?:input|textarea|[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*(?::required|\[required(?:=[^\]]*)?\])(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*:invalid\b|(?:^|[\s>+~,])(?:input|textarea|[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*:invalid(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*(?::required|\[required(?:=[^\]]*)?\])/i;

const TOUCHED_DIRTY_INVALID_SELECTOR_REGEX =
  /(?:[.#[][a-zA-Z0-9_-]*\b(?:is-|ng-|data-)?(?:touched|dirty|interacted|was-validated)\b[^,]*:invalid\b)|(?::invalid\b[^,]*[.#[][a-zA-Z0-9_-]*\b(?:is-|ng-|data-)?(?:touched|dirty|interacted|was-validated)\b)/i;

const USER_INVALID_GUARD_TOKENS = [
  ':user-invalid',
  'user-invalid',
] as const;

const DIRTY_TOUCHED_CLASS_REGEX =
  /['"`](?:is-|ng-)?(?:touched|dirty|interacted|was-validated)['"`]/i;

function isSelectOnlyTargetNode(targetNode: Node | undefined): boolean {
  if (!targetNode) {
    return false;
  }
  const directStripped = targetNode
    .getText()
    .replace(/\bquerySelector(?:All)?\b/g, '');
  const resolvedStripped = resolveLocalExpression(targetNode, 2)
    .getText()
    .replace(/\bquerySelector(?:All)?\b/g, '');

  const hasSelect =
    /\bselect\b/i.test(directStripped) || /\bselect\b/i.test(resolvedStripped);
  const hasInputOrForm =
    /\b(?:input|textarea|field|form)\b/i.test(directStripped) ||
    /\b(?:input|textarea|field|form)\b/i.test(resolvedStripped);

  return hasSelect && !hasInputOrForm;
}

function matchDirtyClassBlurListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['blur', 'invalid']);
  if (!listener) {
    return null;
  }

  if (isSelectOnlyTargetNode(listener.targetNode)) {
    return null;
  }

  const handlerNode = resolveCallableNode(listener.handlerNode);
  if (!isDomClassOrAttrMutation(handlerNode)) {
    return null;
  }

  const handlerText = handlerNode.getText();
  if (!DIRTY_TOUCHED_CLASS_REGEX.test(handlerText)) {
    return null;
  }

  return `Imperative '${listener.eventName}' listener toggling touched/dirty classes to gate validation styling can be modernized with CSS :user-invalid.`;
}

export const requiredFieldFeedbackCssMatcher: CssRuleMatcher = {
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
    if (
      /\bselect\b/i.test(selectorWithoutNot) &&
      !/\b(?:input|textarea)\b/i.test(selectorWithoutNot)
    ) {
      return null;
    }

    const hasRequiredInvalid = REQUIRED_INVALID_SELECTOR_REGEX.test(selectorWithoutNot);
    const hasTouchedDirtyInvalid = TOUCHED_DIRTY_INVALID_SELECTOR_REGEX.test(selectorWithoutNot);

    if (!hasRequiredInvalid && !hasTouchedDirtyInvalid) {
      return null;
    }

    if (hasTouchedDirtyInvalid) {
      return {
        message:
          'CSS selector pairs :invalid with a touched/dirty class (e.g. .was-validated, .touched) to gate invalid styling until user interaction; modernize with native :user-invalid.',
      };
    }

    return {
      message:
        'CSS selector uses :required:invalid or [required]:invalid which styles required fields as invalid before user interaction; modernize with :user-invalid.',
    };
  },
};

export const requiredFieldFeedbackJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['blur', 'invalid', 'touched', 'dirty', 'interacted', 'was-validated'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const message = matchDirtyClassBlurListener(node);
      if (message && !isProtectedByFeatureGuard(node, USER_INVALID_GUARD_TOKENS)) {
        matches.push({
          line: node.getStartLineNumber(),
          message,
        });
      }
    });

    return matches;
  },
};

export const requiredFieldFeedbackCssRule: AnalyzerRule = {
  id: 'required-field-feedback/css-required-invalid',
  guideId: 'required-field-feedback',
  guideHash: REQUIRED_FIELD_FEEDBACK_GUIDE_HASH,
  summary:
    'CSS :required:invalid, [required]:invalid, and touched/dirty :invalid selectors without :user-invalid should be modernized with :user-invalid so form fields only show error styles after user interaction.',
  matcher: requiredFieldFeedbackCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule uses :required:invalid, [required]:invalid, or pairs :invalid with a touched/dirty class (.was-validated, .touched, .dirty) without :user-invalid to style form fields.',
    ],
    dropWhen: [
      'The stylesheet already uses :user-invalid or guards :invalid inside @supports not selector(:user-invalid).',
      'The selector negates :invalid inside :not(:invalid) or styles server-returned asynchronous validation errors.',
    ],
  },
};

export const requiredFieldFeedbackJsRule: AnalyzerRule = {
  id: 'required-field-feedback/js-blur-dirty-class',
  guideId: 'required-field-feedback',
  guideHash: REQUIRED_FIELD_FEEDBACK_GUIDE_HASH,
  summary:
    'JavaScript blur and invalid listeners toggling .touched / .dirty / .interacted / .was-validated classes to gate :invalid styling should be modernized with CSS :user-invalid.',
  matcher: requiredFieldFeedbackJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A blur or invalid event listener on form inputs toggles .touched, .is-touched, .dirty, .interacted, or .was-validated classes to defer :invalid styling until after user interaction.',
    ],
    dropWhen: [
      'The listener only synchronizes aria-invalid attributes for assistive technologies or handles server-returned asynchronous validation errors.',
      'Immediate :invalid styling on submit button click or code guarded by CSS.supports("selector(:user-invalid)").',
    ],
  },
};

export const requiredFieldFeedbackRules: readonly AnalyzerRule[] = [
  requiredFieldFeedbackCssRule,
  requiredFieldFeedbackJsRule,
];
