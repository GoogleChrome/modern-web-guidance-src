import {
  type CallExpression,
  type Node,
} from 'ts-morph';
import {
  isDomClassOrAttrMutation,
  matchEventListenerCall,
  resolveCallableNode,
  resolveLocalExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
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
    if (!selector.toLowerCase().includes(':invalid')) {
      return null;
    }
    if (/\/bootstrap\/|(?:^|\/)bootstrap(?:\.[a-z0-9_-]+)*\.css$/i.test(ctx.filePath)) {
      return null;
    }
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

    // Skip checkbox/radio (.form-check-input), file inputs (.form-control-file/.custom-file-input), input-group z-index layering, and Parsley theme selectors
    if (
      /\.(?:form-check-input|form-control-file|custom-file-input|input-group|parsley-error)\b/i.test(selectorWithoutNot) ||
      (/\.custom-control-input\b/i.test(selectorWithoutNot) &&
        !/:not\(\s*:checked\s*\)/i.test(selector))
    ) {
      return null;
    }

    // Skip rules that only hide validation background icons (background-image: none) without styling error feedback
    const bgImage = styleRule.getPropertyValue('background-image')?.trim().toLowerCase();
    if (
      bgImage === 'none' &&
      !styleRule.hasProperty('border-color') &&
      !styleRule.hasProperty('color') &&
      !styleRule.hasProperty('box-shadow')
    ) {
      return null;
    }

    const hasRequiredInvalid = REQUIRED_INVALID_SELECTOR_REGEX.test(selectorWithoutNot);
    const hasTouchedDirtyInvalid = TOUCHED_DIRTY_INVALID_SELECTOR_REGEX.test(selectorWithoutNot);

    if (!hasRequiredInvalid && !hasTouchedDirtyInvalid) {
      return null;
    }

    // Skip minified single-line CSS bundles where snippet context is unreadable
    const rawLine = ctx.stylesheetText.split('\n')[styleRule.line - 1] ?? '';
    if (rawLine.length > 1000) {
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

export const requiredFieldFeedbackJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['blur', 'invalid', 'touched', 'dirty', 'interacted', 'was-validated'],
  featureGuardTokens: USER_INVALID_GUARD_TOKENS,
  matchCall: (node) => matchDirtyClassBlurListener(node),
});

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
      'The selector only negates :invalid inside :not(:invalid) or only sets background-image: none.',
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

export default [
  requiredFieldFeedbackCssRule,
  requiredFieldFeedbackJsRule,
] satisfies readonly AnalyzerRule[];
