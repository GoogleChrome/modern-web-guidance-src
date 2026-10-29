import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const FLICKER_FREE_CLIENT_SIDE_AB_TESTING_GUIDE_HASH = '514db845f27b';

const ANTI_FLICKER_SELECTOR_REGEX =
  /(?:\.(?:async-hide|ab-loading|anti-flicker)|#_vis_opt_path_hides)(?![\w-])/i;
const ZERO_OPACITY_VALUE_REGEX = /^0(?:\.0+)?(?:\s*!important)?$/i;
const HIDDEN_VISIBILITY_VALUE_REGEX = /^hidden(?:\s*!important)?$/i;

export const flickerFreeClientSideAbTestingMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['async-hide', 'ab-loading', 'anti-flicker', '_vis_opt_path_hides'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    if (
      ctx.stylesheetText.includes('blocking="render"') ||
      ctx.stylesheetText.includes("blocking='render'") ||
      ctx.stylesheetText.includes("HTMLScriptElement.prototype, 'blocking'") ||
      ctx.stylesheetText.includes('HTMLScriptElement.prototype, "blocking"')
    ) {
      return null;
    }

    if (!ANTI_FLICKER_SELECTOR_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    const opacityValue = (styleRule.getPropertyValue('opacity') ?? '').trim();
    const visibilityValue = (styleRule.getPropertyValue('visibility') ?? '').trim();
    if (
      !ZERO_OPACITY_VALUE_REGEX.test(opacityValue) &&
      !HIDDEN_VISIBILITY_VALUE_REGEX.test(visibilityValue)
    ) {
      return null;
    }

    return {
      message:
        'Legacy anti-flicker page-hiding rule (.async-hide { opacity: 0 !important }) delays first paint; load experimentation scripts with <script async blocking="render"> in <head> instead.',
    };
  },
};

export const flickerFreeClientSideAbTestingRule: AnalyzerRule = {
  id: 'flicker-free-client-side-ab-testing',
  guideId: 'flicker-free-client-side-ab-testing',
  guideHash: FLICKER_FREE_CLIENT_SIDE_AB_TESTING_GUIDE_HASH,
  summary:
    'Replace legacy .async-hide { opacity: 0 !important } anti-flicker snippets with <script async blocking="render"> in <head>.',
  matcher: flickerFreeClientSideAbTestingMatcher,
  verifierRubric: {
    keepWhen: [
      'A stylesheet or inline <style> defines a page-hiding anti-flicker rule (such as .async-hide { opacity: 0 !important }, .ab-loading { opacity: 0 }, or #_vis_opt_path_hides) without using blocking="render".',
    ],
    dropWhen: [
      'The anti-flicker class is guarded as a fallback behind !Object.hasOwn(HTMLScriptElement.prototype, "blocking") alongside <script blocking="render">.',
      'Standard CSS opacity transitions, animations, or component-level loading states unrelated to full-page A/B test anti-flicker snippets.',
    ],
  },
};

export default [
  flickerFreeClientSideAbTestingRule,
] satisfies readonly AnalyzerRule[];
