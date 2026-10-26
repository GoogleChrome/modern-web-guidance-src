import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const CUSTOM_TEXT_DECORATIONS_GUIDE_HASH = '050e45377dd8';

const INLINE_OR_LINK_SELECTOR_REGEX =
  /(?:^|[\s>+~,])(?:a(?:\.[\w-]+|:[a-z-]+)*|\.link|\.underline|\.text-link|\.nav-link|\.content-link|span(?:\.[\w-]+)*|p\s+a|li\s+a)(?:$|[\s>+~,:])/i;

const BLOCK_CONTAINER_SELECTOR_REGEX =
  /\b(?:card|panel|modal|dialog|header|footer|table|tr|th|td|row|col|container|wrapper|sidebar|navbar|dropdown|tab|tabs|nav-tabs|btn|button|badge|box|section|chip|avatar|pill|menu|item|nav-item|list-item|toolbar|alert|toast|banner)\b/i;

const BUTTON_OR_BADGE_REGEX = /\b(?:btn|button|badge|pill|chip|tab|nav-link|menu-item)\b/i;

const MODERN_DECORATION_PROPERTIES = new Set([
  'text-underline-offset',
  'text-decoration-thickness',
  'text-decoration-skip-ink',
  'text-decoration-inset',
]);

const OTHER_BORDER_PROPERTIES = new Set([
  'border-top',
  'border-top-width',
  'border-left',
  'border-left-width',
  'border-right',
  'border-right-width',
  'border',
  'border-width',
]);

const BOX_SHAPE_PROPERTIES = new Set([
  'box-shadow',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'width',
  'height',
  'min-width',
  'min-height',
]);

export const customTextDecorationsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['border-bottom', 'text-decoration'] as const,
  matchRule(styleRule: CssRuleView, _ctx: CssMatcherContext): { message: string } | null {
    const selector = styleRule.selectorText.trim();

    // Check if selector matches inline text or links
    if (!INLINE_OR_LINK_SELECTOR_REGEX.test(selector)) {
      return null;
    }

    // Reject buttons, pills, badges, tabs, and menu items even if rendered as <a> elements
    if (BUTTON_OR_BADGE_REGEX.test(selector) && !/\.underline\b/i.test(selector)) {
      return null;
    }

    // Reject block containers, tab bars, or button classes
    if (BLOCK_CONTAINER_SELECTOR_REGEX.test(selector) && !/\ba\b/.test(selector) && !/\.link\b/.test(selector)) {
      return null;
    }

    // Check for display: block, flex, grid
    const displayVal = styleRule.getPropertyValue('display');
    if (displayVal) {
      const lowerDisplay = displayVal.toLowerCase();
      if (
        lowerDisplay === 'block' ||
        lowerDisplay === 'flex' ||
        lowerDisplay === 'grid' ||
        lowerDisplay === 'table'
      ) {
        return null;
      }
    }

    // Reject non-text elements declaring box-shadow, border-radius, or explicit width/height
    for (const prop of BOX_SHAPE_PROPERTIES) {
      if (styleRule.hasProperty(prop)) {
        return null;
      }
    }

    // Reject if already using modern text decoration properties
    for (const prop of MODERN_DECORATION_PROPERTIES) {
      if (styleRule.hasProperty(prop)) {
        return null;
      }
    }

    // Reject if other borders (top, left, right, or all-around border) are declared
    for (const prop of OTHER_BORDER_PROPERTIES) {
      const val = styleRule.getPropertyValue(prop);
      if (val && val !== 'none' && val !== '0') {
        return null;
      }
    }

    // Must have border-bottom or border-bottom-width
    const borderBottom =
      styleRule.getPropertyValue('border-bottom') ||
      styleRule.getPropertyValue('border-bottom-width');
    if (!borderBottom || borderBottom === 'none' || borderBottom === '0') {
      return null;
    }

    // Must have text-decoration: none (or text-decoration-line: none)
    const textDecoration =
      styleRule.getPropertyValue('text-decoration') ||
      styleRule.getPropertyValue('text-decoration-line');
    const hasTextDecNone = textDecoration && textDecoration.toLowerCase().includes('none');

    // And padding-bottom (used to create underline spacing offset)
    const hasPaddingBottom =
      styleRule.hasProperty('padding-bottom') ||
      styleRule.hasProperty('padding');

    // Underline simulation requires removing standard underline (text-decoration: none)
    // or having explicit .underline class naming, AND setting padding-bottom to offset the border
    const isExplicitUnderline = /\.underline\b/i.test(selector);
    if (!hasTextDecNone && !isExplicitUnderline) {
      return null;
    }

    if (!hasPaddingBottom && !isExplicitUnderline) {
      return null;
    }

    return {
      message:
        'Simulating text underline with border-bottom and padding-bottom; native text-decoration with text-underline-offset and text-decoration-thickness avoids box-model side-effects and follows text wrapping.',
    };
  },
};

export const customTextDecorationsRule: AnalyzerRule = {
  id: 'custom-text-decorations',
  guideId: 'custom-text-decorations',
  guideHash: CUSTOM_TEXT_DECORATIONS_GUIDE_HASH,
  summary:
    'Use native CSS text-decoration shorthand, text-decoration-thickness, and text-underline-offset instead of border-bottom and padding-bottom underline hacks.',
  matcher: customTextDecorationsCssMatcher,
  verifierRubric: {
    keepWhen: [
      'CSS border-bottom and padding-bottom underline simulation on inline text or link selectors paired with text-decoration: none',
      'CSS linear-gradient underline background hacks on inline text or link elements paired with text-decoration: none',
    ],
    dropWhen: [
      'Block-level container borders (cards, tables, panels, modals, headers, footers)',
      'Tab navigation component active state indicators (.tab, [role="tab"])',
      'Rule declaring display: block, flex, or grid',
      'Rule already declaring text-underline-offset or text-decoration-thickness',
    ],
  },
};

export const customTextDecorationsRules: readonly AnalyzerRule[] = [
  customTextDecorationsRule,
];
