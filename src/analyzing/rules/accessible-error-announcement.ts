import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const ERROR_STYLE_PROPERTIES = [
  'border',
  'border-color',
  'outline',
  'outline-color',
  'color',
  'background',
  'background-color',
  'box-shadow',
] as const;

const SUBMISSION_GATED_SELECTORS = [
  '.was-validated',
  '.is-validated',
  '.submitted',
  '.has-submitted',
] as const;

const accessibleErrorAnnouncementCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [':invalid'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines modern :user-invalid, skip
    if (ctx.stylesheetHasValue(':user-invalid')) {
      return null;
    }

    // 2. Selector must use raw :invalid pseudo-class
    if (!styleRule.selectorText.includes(':invalid')) {
      return null;
    }

    // 3. Skip if already combined with :user-invalid
    if (styleRule.selectorText.includes(':user-invalid')) {
      return null;
    }

    // 4. Skip submission-gated forms (e.g. Bootstrap .was-validated) where validation is user-deferred
    if (
      SUBMISSION_GATED_SELECTORS.some((sel) =>
        styleRule.selectorText.includes(sel),
      )
    ) {
      return null;
    }

    // 5. Rule must apply visual error cues (border, outline, color, background, box-shadow)
    const hasErrorStyle = ERROR_STYLE_PROPERTIES.some((prop) =>
      styleRule.hasProperty(prop),
    );
    if (!hasErrorStyle) {
      return null;
    }

    return {
      message:
        'CSS rule styles form controls using raw :invalid, which triggers error cues before user interaction; modernize with :user-invalid and synchronize with aria-invalid.',
    };
  },
};

export const accessibleErrorAnnouncementRule: AnalyzerRule = {
  id: 'accessible-error-announcement',
  guideId: 'accessible-error-announcement',
  guideHash: 'b89c17bead92',
  summary:
    'Raw :invalid CSS selector applies error styling before interaction; modernize with :user-invalid and synchronize with aria-invalid.',
  matcher: accessibleErrorAnnouncementCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule applies visual error styles (borders, outlines, text colors, background tints, or box shadows) to form controls using raw :invalid (e.g. input:invalid, :invalid:not(:placeholder-shown), input:focus:invalid).',
      'The error styling triggers prematurely on pristine or uncompleted form fields before user interaction, flashing error cues and disrupting screen reader users.',
      'The stylesheet does not use modern :user-invalid or synchronize error cues with accessibility attributes (aria-invalid, aria-errormessage).',
    ],
    dropWhen: [
      'The stylesheet already defines standard :user-invalid styling.',
      'The rule is gated behind a form submission state class (e.g. .was-validated, .is-submitted) that only activates after the user submits.',
      'The rule applies only to type="submit" or type="button" controls.',
      'The rule is part of a fallback guarded by @supports not selector(:user-invalid).',
    ],
  },
};

export const accessibleErrorAnnouncementRules: readonly AnalyzerRule[] = [
  accessibleErrorAnnouncementRule,
];
