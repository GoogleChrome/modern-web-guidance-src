import {
  type CallExpression,
  type Node,
  SyntaxKind,
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

export const SELECT_MENU_INTERACTION_GUIDE_HASH = '3d0aae1e8d74';

const SELECT_INVALID_SELECTOR_REGEX =
  /(?:^|[\s>+~,])select(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*:invalid\b/i;

const USER_INVALID_GUARD_TOKENS = [
  ':user-invalid',
  'user-invalid',
] as const;

const TOUCHED_OR_VALIDATED_GATE_REGEX =
  /(?:\.(?:was-validated|is-validated|validated|touched|is-touched|ng-touched|dirty|is-dirty|ng-dirty|interacted|submitted)\b|\bform\.invalid\b|\[data-(?:touched|dirty|interacted|validated)\b)/i;

const CUSTOM_SELECT_WIDGET_CSS_REGEX =
  /\.(?:select2|chosen-container|choices|ts-wrapper|ts-control|vs__dropdown|multiselect)\b/i;

const REQUIRED_MULTI_CONTROL_OVERLAP_REGEX =
  /\b(?:input|textarea)\b[\s\S]*?(?::required\b|\[required\b)|(?::required\b|\[required\b)[\s\S]*?\b(?:input|textarea)\b/i;

const ERROR_OR_DISPLAY_PROPERTIES = new Set([
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'background',
  'background-color',
  'background-image',
  'color',
  'box-shadow',
  '-webkit-box-shadow',
  '-moz-box-shadow',
  'outline',
  'outline-color',
  'display',
  'visibility',
  'opacity',
]);

const RESET_PROP_VALUES = new Set([
  'none',
  '0',
  '0px',
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
  'normal',
  'auto',
]);

const EXPLICIT_ERROR_COLOR_TOKEN_REGEX =
  /\b(?:red|crimson|firebrick|darkred|maroon)\b|--[a-z0-9-]*(?:error|danger|invalid|alert|warn)|#(?:f00|ff0000|d00|c00|e00|dc3545|ef4444|f44336|d32f2f|b91c1c|b94a48|cc0000)\b/i;

function normalizeCssDeclValue(raw: string): string {
  return raw.replace(/\s*!important\s*$/i, '').trim().toLowerCase();
}

function isPlaceholderColorEmulation(styleRule: CssRuleView): boolean {
  if (/placeholder/i.test(styleRule.selectorText)) {
    return true;
  }
  if (styleRule.declarations.some((d) => /placeholder/i.test(d.value))) {
    return true;
  }

  // If the rule only sets color and/or opacity (no non-reset border, background, outline, box-shadow, display, visibility)
  // and the color value does not contain an explicit error/danger color token, it is dimming the unselected <option value=""> placeholder
  const nonResetVisualDecls = styleRule.declarations.filter((d) => {
    const prop = d.property.toLowerCase();
    if (!ERROR_OR_DISPLAY_PROPERTIES.has(prop)) {
      return false;
    }
    const val = normalizeCssDeclValue(d.value);
    return Boolean(val && !RESET_PROP_VALUES.has(val));
  });

  if (
    nonResetVisualDecls.length > 0 &&
    nonResetVisualDecls.every((d) => {
      const prop = d.property.toLowerCase();
      return prop === 'color' || prop === 'opacity';
    })
  ) {
    const hasExplicitErrorColor = nonResetVisualDecls.some(
      (d) =>
        d.property.toLowerCase() === 'color' &&
        EXPLICIT_ERROR_COLOR_TOKEN_REGEX.test(d.value),
    );
    if (!hasExplicitErrorColor) {
      return true;
    }
  }

  return false;
}

function hasNonResetVisualErrorDeclaration(styleRule: CssRuleView): boolean {
  return styleRule.declarations.some((d) => {
    const prop = d.property.toLowerCase();
    if (!ERROR_OR_DISPLAY_PROPERTIES.has(prop)) {
      return false;
    }
    const val = normalizeCssDeclValue(d.value);
    if (!val || RESET_PROP_VALUES.has(val)) {
      return false;
    }
    return true;
  });
}

const SELECT_IDENTIFIER_REGEX =
  /(?:^|[^a-zA-Z0-9_$])select(?:El|Element|Menu|Box|Field|Dropdown|s)?(?![a-zA-Z0-9_$])/i;

const CUSTOM_SELECT_WIDGET_JS_REGEX =
  /\b(?:select2|chosen|choices|tomSelect|multiselect|combobox|autocomplete|datepicker)\b/i;

function isSelectTargetText(text: string): boolean {
  if (
    /\[[^\]]*\bmultiple\b[^\]]*\]/i.test(text) ||
    CUSTOM_SELECT_WIDGET_JS_REGEX.test(text) ||
    /\b(?:input|textarea)\b/i.test(text)
  ) {
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
    /\[[^\]]*\bmultiple\b[^\]]*\]/i.test(resolvedText) ||
    CUSTOM_SELECT_WIDGET_JS_REGEX.test(directText) ||
    CUSTOM_SELECT_WIDGET_JS_REGEX.test(resolvedText) ||
    /\b(?:input|textarea)\b/i.test(directText) ||
    /\b(?:input|textarea)\b/i.test(resolvedText)
  ) {
    return false;
  }
  if (isSelectTargetText(directText)) {
    return true;
  }
  return isSelectTargetText(resolvedText);
}

function mutatesInvalidOrTouchedState(handlerRoot: Node): boolean {
  const innerCalls = [
    ...(handlerRoot.getKind() === SyntaxKind.CallExpression ? [handlerRoot] : []),
    ...handlerRoot.getDescendantsOfKind(SyntaxKind.CallExpression),
  ];
  for (const call of innerCalls) {
    const callText = call.getText();
    if (
      /\.classList\.(?:add|remove|toggle)\s*\([^)]*(?:invalid|error|touched|dirty|valid)\b/i.test(
        callText,
      ) ||
      /\.(?:addClass|removeClass|toggleClass)\s*\([^)]*(?:invalid|error|touched|dirty|valid)\b/i.test(
        callText,
      ) ||
      /\.(?:setAttribute|removeAttribute|toggleAttribute)\s*\(\s*['"`](?:aria-invalid|data-(?:invalid|error|touched|dirty))\b/i.test(
        callText,
      )
    ) {
      return true;
    }
  }

  const handlerText = handlerRoot.getText();
  return /\.className\b[^;]*(?:invalid|error|touched|dirty)\b/i.test(handlerText);
}

function matchSelectValidationListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['blur', 'change']);
  if (!listener) {
    return null;
  }

  if (!isSelectTargetNode(listener.targetNode)) {
    return null;
  }

  const resolvedHandler = resolveCallableNode(listener.handlerNode);
  if (!isDomClassOrAttrMutation(resolvedHandler)) {
    return null;
  }

  const handlerText = resolvedHandler.getText();
  const checksEmptyOrInvalid =
    /\.value\s*===\s*['"`]{2}|!\s*[a-zA-Z0-9_$.]+\.value\b|checkValidity\s*\(|validity\.valid/.test(
      handlerText,
    );

  if (!checksEmptyOrInvalid || !mutatesInvalidOrTouchedState(resolvedHandler)) {
    return null;
  }

  return `Imperative '${listener.eventName}' listener toggling invalid/error state on <select> can be modernized with native <select required> and CSS select:user-invalid.`;
}

export const selectMenuInteractionCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [
    [':invalid'],
    ['select', 'Select'],
  ],
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

    // Skip selectors already gated by touched/dirty/validated classes or third-party custom select widgets
    if (
      TOUCHED_OR_VALIDATED_GATE_REGEX.test(selector) ||
      CUSTOM_SELECT_WIDGET_CSS_REGEX.test(selector)
    ) {
      return null;
    }

    // Carve out multi-control :required:invalid rules owned by required-field-feedback
    if (REQUIRED_MULTI_CONTROL_OVERLAP_REGEX.test(selector)) {
      return null;
    }

    // Skip placeholder dimming rules (e.g. pairing select:invalid with ::placeholder)
    if (isPlaceholderColorEmulation(styleRule)) {
      return null;
    }

    const selectorWithoutNot = selector.replace(/:not\([^)]*\)/gi, '');
    if (!SELECT_INVALID_SELECTOR_REGEX.test(selectorWithoutNot)) {
      return null;
    }

    // Require at least one non-reset visual error or display declaration (skip box-shadow: none resets)
    if (!hasNonResetVisualErrorDeclaration(styleRule)) {
      return null;
    }

    return {
      message:
        'CSS selector uses select:invalid which styles required <select> menus as invalid before user interaction; modernize with select:user-invalid.',
    };
  },
};

export const selectMenuInteractionJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    ["'blur'", '"blur"', '`blur`', "'change'", '"change"', '`change`', '.blur(', '.change(', 'onblur', 'onchange'],
    ['select', 'Select'],
    ['.value', 'checkValidity', 'validity'],
    [
      '.classList.',
      '.addClass(',
      '.removeClass(',
      '.toggleClass(',
      '.setAttribute(',
      '.removeAttribute(',
      '.toggleAttribute(',
      '.className',
    ],
    ['invalid', 'Invalid', 'error', 'Error', 'touched', 'Touched', 'dirty', 'Dirty', 'valid', 'Valid'],
  ],
  featureGuardTokens: USER_INVALID_GUARD_TOKENS,
  matchCall: matchSelectValidationListener,
});

export const selectMenuInteractionCssRule: AnalyzerRule = {
  id: 'select-menu-interaction/css-select-invalid',
  guideId: 'select-menu-interaction',
  guideHash: SELECT_MENU_INTERACTION_GUIDE_HASH,
  summary:
    'CSS select:invalid selectors without :user-invalid should be modernized with select:user-invalid so required dropdowns only show error styles after interaction.',
  matcher: selectMenuInteractionCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule uses select:invalid (standalone or grouped with input:invalid / textarea:invalid without :required) without :user-invalid to apply validation error styling (border, border-color, background, background-color, error text color, or non-none outline/box-shadow).',
      'A CSS rule uses select:invalid with an adjacent or general sibling combinator (+ or ~) to reveal or style a validation error message element before user interaction.',
    ],
    dropWhen: [
      'The stylesheet already uses :user-invalid or guards select:invalid inside @supports not selector(:user-invalid).',
      'The rule declarations solely reset browser default :invalid styles (only setting box-shadow: none or outline: none with no border, background, or error color styling) or only dim unselected placeholder text color/opacity to muted gray tones.',
      'Every select:invalid selector in the rule is already gated by a post-interaction or submitted state class (.was-validated, .touched, .dirty, .submitted) or targets a custom select widget library (.select2, .chosen-container, .choices, .ts-wrapper).',
      'The selector explicitly combines :required:invalid or [required]:invalid across both input/textarea and select (owned by required-field-feedback).',
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
      'A change or blur event listener on a native <select> element checks select.value === "" or !select.value and toggles an invalid, error, or touched class or aria-invalid attribute.',
    ],
    dropWhen: [
      'The listener is guarded by a CSS.supports("selector(:user-invalid)") check.',
      'The handler targets text <input>/<textarea> controls, multi-select inputs, custom select libraries (Select2, Chosen, Choices.js, TomSelect), or asynchronous server-side validation responses.',
    ],
  },
};

export default [
  selectMenuInteractionCssRule,
  selectMenuInteractionJsRule,
] satisfies readonly AnalyzerRule[];
