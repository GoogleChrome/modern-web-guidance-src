import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const BRAND_CONSISTENT_FORMS_GUIDE_HASH = 'a040352d2507';

const TARGET_SELECTOR_PATTERNS = [
  /input\[type=['"]?checkbox['"]?\]/i,
  /input\[type=['"]?radio['"]?\]/i,
  /input\[type=['"]?range['"]?\]/i,
  /\bprogress\b/i,
  /\.custom-(checkbox|radio|range)\b/i,
  /\.form-(check-input|range)\b/i,
];

const EXCLUDED_SELECTOR_PATTERNS = [
  /spin-button/i,
  /input\[type=['"]?search['"]?\]/i,
  /input\[type=['"]?number['"]?\]/i,
  /\bbutton\b/i,
  /\bselect\b/i,
  /\btextarea\b/i,
];

const VENDOR_SLIDER_PROGRESS_REGEX =
  /:(?:-(?:webkit|moz|ms)-(?:slider-thumb|slider-runnable-track|range-thumb|range-track|thumb|track|progress-bar|progress-value))\b/i;

function targetsBrandableFormControl(selectorText: string): boolean {
  if (EXCLUDED_SELECTOR_PATTERNS.some((pattern) => pattern.test(selectorText))) {
    return false;
  }
  return TARGET_SELECTOR_PATTERNS.some((pattern) => pattern.test(selectorText));
}

function targetsVendorSliderOrProgressBar(selectorText: string): boolean {
  return VENDOR_SLIDER_PROGRESS_REGEX.test(selectorText);
}

function hasAppearanceNone(styleRule: CssRuleView): boolean {
  const appearance = (styleRule.getPropertyValue('appearance') ?? '').toLowerCase();
  const webkitAppearance = (
    styleRule.getPropertyValue('-webkit-appearance') ?? ''
  ).toLowerCase();
  const mozAppearance = (
    styleRule.getPropertyValue('-moz-appearance') ?? ''
  ).toLowerCase();

  return (
    appearance === 'none' ||
    webkitAppearance === 'none' ||
    mozAppearance === 'none'
  );
}

const brandConsistentFormsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [
    'appearance',
    '-webkit-slider-',
    '-moz-range-',
    '-webkit-progress-',
    '-moz-progress-',
    '-ms-thumb',
    '-ms-track',
  ],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines accent-color, skip
    if (ctx.stylesheetHasProperty('accent-color')) {
      return null;
    }

    // 2. Skip fallback blocks inside @supports not (accent-color: ...)
    if (
      styleRule.parentAtRule &&
      styleRule.parentAtRule.toLowerCase().includes('accent-color')
    ) {
      return null;
    }

    // 3. Skip completely hidden controls (display: none)
    const display = (styleRule.getPropertyValue('display') ?? '').toLowerCase();
    if (display === 'none') {
      return null;
    }

    // 4. Check vendor pseudo-elements for slider / progress styling
    if (targetsVendorSliderOrProgressBar(styleRule.selectorText)) {
      const setsColor =
        styleRule.hasProperty('background') ||
        styleRule.hasProperty('background-color') ||
        styleRule.hasProperty('border-color');
      if (setsColor) {
        return {
          message:
            'CSS rule styles vendor range-slider or progress-bar pseudo-elements; modernize with native accent-color.',
        };
      }
    }

    // 5. Must declare appearance: none on brandable control
    if (!hasAppearanceNone(styleRule)) {
      return null;
    }

    if (!targetsBrandableFormControl(styleRule.selectorText)) {
      return null;
    }

    return {
      message:
        'CSS rule strips native form appearance with appearance: none; modernize with accent-color for brand-consistent checkboxes, radios, range sliders, and progress bars.',
    };
  },
};

export const brandConsistentFormsRule: AnalyzerRule = {
  id: 'brand-consistent-forms',
  guideId: 'brand-consistent-forms',
  guideHash: BRAND_CONSISTENT_FORMS_GUIDE_HASH,
  summary:
    'Custom checkbox, radio, range, or progress styling stripping appearance: none should use accent-color for brand-consistent form controls.',
  matcher: brandConsistentFormsCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'A CSS rule applies appearance: none, -webkit-appearance: none, or -moz-appearance: none to input[type="checkbox"], input[type="radio"], input[type="range"], or progress to restyle native control colors.',
      'A CSS rule styles vendor range slider or progress bar pseudo-elements (e.g. ::-webkit-slider-thumb, ::-moz-range-track, ::-webkit-progress-value) with custom background or border colors without using accent-color.',
    ],
    dropWhen: [
      'The stylesheet already defines accent-color or uses it to tint interactive controls.',
      'The rule is inside a progressive enhancement fallback block like @supports not (accent-color: ...).',
      'The element is an input[type="search"], spin button, button, or select element rather than an accent-color compatible control.',
      'The control is completely hidden with display: none to build an entirely decoupled custom widget.',
    ],
  },
};

// Both sub-rules retired per O8 slice 2 audit (contradicts checkbox guide, 0/111 genuine like-for-like)
export const brandConsistentFormsRules: readonly AnalyzerRule[] = [];
