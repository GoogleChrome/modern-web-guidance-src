import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const animateToIntrinsicSizesCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['max-height'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already opts into modern intrinsic sizing interpolation, skip
    if (
      ctx.stylesheetHasProperty('interpolate-size') ||
      ctx.stylesheetHasValue('calc-size(')
    ) {
      return null;
    }

    // 2. Skip scrollable containers where max-height acts as a viewport constraint
    const overflow = (styleRule.getPropertyValue('overflow') ?? '').toLowerCase();
    const overflowY = (styleRule.getPropertyValue('overflow-y') ?? '').toLowerCase();
    if (
      overflow === 'auto' ||
      overflow === 'scroll' ||
      overflowY === 'auto' ||
      overflowY === 'scroll'
    ) {
      return null;
    }

    // 3. Inspect transition definitions
    const transition = (styleRule.getPropertyValue('transition') ?? '').toLowerCase();
    const transitionProp = (
      styleRule.getPropertyValue('transition-property') ?? ''
    ).toLowerCase();

    if (transition === 'none' || transitionProp === 'none') {
      return null;
    }

    const maxHeight = (styleRule.getPropertyValue('max-height') ?? '').toLowerCase();
    if (maxHeight === 'none') {
      return null;
    }

    // 4. Check whether max-height is explicitly transitioned, or transitioned via 'all'
    const transitionsMaxHeight =
      transition.includes('max-height') ||
      transitionProp.includes('max-height') ||
      ((transition.includes('all') || transitionProp.includes('all')) &&
        styleRule.hasProperty('max-height'));

    if (!transitionsMaxHeight) {
      return null;
    }

    return {
      message:
        'CSS rule transitions max-height to animate dimensions; use interpolate-size: allow-keywords and animate height or block-size directly.',
    };
  },
};

export const animateToIntrinsicSizesRule: AnalyzerRule = {
  id: 'animate-to-intrinsic-sizes',
  guideId: 'animate-to-intrinsic-sizes',
  guideHash: '290b14ca7ee4',
  summary:
    'CSS transition on max-height simulates intrinsic size animation; modernize with interpolate-size: allow-keywords or calc-size().',
  matcher: animateToIntrinsicSizesCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule animates or transitions max-height (or transitions all alongside a max-height declaration) to simulate accordion, dropdown, drawer, or modal expansion/collapse.',
      'The element uses max-height as a proxy for natural content height because pure height cannot transition to auto without interpolate-size.',
    ],
    dropWhen: [
      'The container is a scrollable panel with overflow: scroll or overflow: auto where max-height defines a legitimate scrolling boundary.',
      'The stylesheet already specifies interpolate-size: allow-keywords or uses calc-size().',
      'The transition property is none or explicitly excludes height/max-height.',
      'The max-height property is none or an unconstrained reset.',
    ],
  },
};

export const animateToIntrinsicSizesRules: readonly AnalyzerRule[] = [
  animateToIntrinsicSizesRule,
];
