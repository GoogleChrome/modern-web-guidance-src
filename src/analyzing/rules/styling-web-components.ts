import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const STYLING_WEB_COMPONENTS_GUIDE_HASH = '396647b6e310';

const FAST_TOKENS: readonly string[] = [':host-context'] as const;

const HOST_CONTEXT_REGEX = /::?host-context\s*\(/i;

const EXCLUDED_PATH_PATTERNS: readonly RegExp[] = [
  /(?:^|[\\/])(?:tests?|fixtures?|__tests__|__mocks__|spec|specs)[\\/]/i,
  /(?:^|[\\/])(?:node_modules|vendor|bower_components|dist|build|out|\.next|\.nuxt|\.output)[\\/]/i,
  /(?:^|[\\/])(?:polyfills?|shims?)[\\/]/i,
  /\.min\.(?:css|scss|less)$/i,
  /(?:^|[\\/])(?:documentation|docs?|examples?|samples?|demos?)[\\/]/i,
  /(?:^|[\\/._-])(?:bootstrap|tailwind|bulma|foundation|materialize|reset|normalize|reboot)(?:[\\/._-]|$)/i,
];

const VALID_HOST_CONTEXT_ROOT_REGEX = /^\s*(?::host(?:\([^)]*\))?)?:host-context\s*\(/i;

export const stylingWebComponentsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: FAST_TOKENS,
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    const filePath = ctx.filePath;
    if (EXCLUDED_PATH_PATTERNS.some((p) => p.test(filePath))) {
      return null;
    }

    const selector = styleRule.selectorText.trim();

    if (!HOST_CONTEXT_REGEX.test(selector)) {
      return null;
    }

    // In Shadow DOM, :host-context() is only valid as the root/host-targeting selector
    // Descendant usage like `.container :host-context(...)` indicates non-shadow light-DOM or mock usage
    if (!VALID_HOST_CONTEXT_ROOT_REGEX.test(selector)) {
      return null;
    }

    // Skip if guarded by @supports or polyfill fallback block
    if (styleRule.parentAtRule) {
      const atRuleLower = styleRule.parentAtRule.toLowerCase();
      if (
        atRuleLower.includes('@supports') &&
        (atRuleLower.includes(':host-context') || atRuleLower.includes('selector(:host-context'))
      ) {
        return null;
      }
      if (atRuleLower.includes('@container') && atRuleLower.includes('style(')) {
        return null;
      }
    }

    return {
      message:
        'CSS selector uses non-standard :host-context() pseudo-class (unsupported in Firefox and Safari); modernize theming using inherited CSS custom properties or container style queries.',
    };
  },
};

export const stylingWebComponentsRule: AnalyzerRule = {
  id: 'styling-web-components',
  guideId: 'styling-web-components',
  guideHash: STYLING_WEB_COMPONENTS_GUIDE_HASH,
  summary:
    'Avoid non-standard :host-context() pseudo-classes in web component styles; modernize theming using inherited CSS custom properties or container style queries.',
  matcher: stylingWebComponentsCssMatcher,
  verifierRubric: {
    keepWhen: [
      'The component stylesheet uses non-standard :host-context(...) to style based on ancestor Light DOM state instead of standard inherited CSS custom properties or ::part().',
      'The stylesheet attempts ancestor-based theme matching via :host-context([theme="dark"]) or :host-context([dir="rtl"]) inside shadow DOM stylesheets.',
    ],
    dropWhen: [
      'The selector uses standard Shadow DOM encapsulation selectors like :host, :host(...), ::part(...), ::slotted(...), or :state(...).',
      'The rule is inside third-party vendor code or polyfills designed specifically to emulate :host-context.',
      'The stylesheet uses modern container queries or CSS custom properties for cross-boundary theming.',
    ],
  },
};

export const stylingWebComponentsRules: readonly AnalyzerRule[] = [
  stylingWebComponentsRule,
];
