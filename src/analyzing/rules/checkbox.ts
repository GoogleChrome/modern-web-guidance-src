import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const CHECKBOX_SELECTOR_REGEX =
  /(?:(?:input)?\[type=["']?checkbox["']?|\.checkbox\b[^{,]*input|\binput\b[^{,]*\.checkbox\b)/i;

const SR_ONLY_REGEX = /\.(?:sr-only|visually-hidden)\b/i;

const checkboxCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['checkbox'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines accent-color, skip
    if (ctx.stylesheetHasProperty('accent-color')) {
      return null;
    }

    // 2. Skip screen-reader accessibility utility classes
    if (SR_ONLY_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    // 3. Selector must target checkbox input
    if (!CHECKBOX_SELECTOR_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    // 4. Must hide the native checkbox: display: none OR (opacity: 0 AND position: absolute)
    const displayVal = (styleRule.getPropertyValue('display') ?? '').trim().toLowerCase();
    const opacityVal = (styleRule.getPropertyValue('opacity') ?? '').trim();
    const positionVal = (styleRule.getPropertyValue('position') ?? '').trim().toLowerCase();

    const isDisplayNone = displayVal === 'none';
    const isOpacityZeroAbs =
      (opacityVal === '0' || opacityVal === '0%') && positionVal === 'absolute';

    if (!isDisplayNone && !isOpacityZeroAbs) {
      return null;
    }

    return {
      message:
        'CSS rule hides native checkbox with display: none or opacity: 0; modernize using accent-color or appearance: none.',
    };
  },
};

export const checkboxRule: AnalyzerRule = {
  id: 'checkbox',
  guideId: 'checkbox',
  guideHash: '1b9c35459943',
  summary:
    'Hiding native checkboxes with display: none or absolute opacity: 0 should be replaced with native accent-color or custom appearance: none styling.',
  matcher: checkboxCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule targets input[type="checkbox"] (or .checkbox input) and hides the native control using display: none or opacity: 0 with position: absolute to render a custom pseudo-element replacement.',
      'The custom checkbox design does not use standard CSS accent-color.',
    ],
    dropWhen: [
      'The stylesheet already defines standard accent-color property declarations.',
      'The selector is an accessible screen-reader utility class (.sr-only or .visually-hidden) that preserves keyboard accessibility and element geometry.',
      'The rule uses appearance: none on the checkbox rather than hiding the element with display: none or opacity: 0.',
    ],
  },
};

export const checkboxRules: readonly AnalyzerRule[] = [checkboxRule];
