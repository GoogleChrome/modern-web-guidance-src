import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const DARK_MODE_GUIDE_HASH = '796876897c2c';

const matchedCssContexts = new WeakSet<CssMatcherContext>();

const darkModeCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['prefers-color-scheme'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. Skip if stylesheet defines standard dark color-scheme or light-dark() function (D-3)
    if (
      /(?:^|[^\w-])color-scheme\s*:[^;}]*\bdark\b/i.test(ctx.stylesheetText) ||
      ctx.stylesheetHasValue('light-dark(')
    ) {
      return null;
    }

    // 2. Skip email or newsletter templates (D-6)
    const lowerFilePath = ctx.filePath.toLowerCase();
    if (
      /(?:^|[\\/._-])(?:e-?mails?|newsletters?)(?:[\\/._-]|$)/.test(lowerFilePath) ||
      ctx.stylesheetText.includes('supported-color-schemes')
    ) {
      return null;
    }

    // 3. Check if rule is enclosed in @media (prefers-color-scheme: dark)
    const atRule = styleRule.parentAtRule?.toLowerCase();
    if (!atRule || !atRule.includes('prefers-color-scheme') || !atRule.includes('dark')) {
      return null;
    }

    // 4. Require at least one color-valued declaration (D-4)
    const hasColorDeclaration = styleRule.declarations.some((decl) =>
      /(?:color|background|border|fill|stroke)/i.test(decl.property),
    );
    if (!hasColorDeclaration) {
      return null;
    }

    // 5. Emit at most 1 finding per file at the first matching rule (D-1)
    if (matchedCssContexts.has(ctx)) {
      return null;
    }
    matchedCssContexts.add(ctx);

    return {
      message:
        'CSS rule inside @media (prefers-color-scheme: dark) overrides colors; modernize using color-scheme: light dark and light-dark() CSS color functions.',
    };
  },
};

export const darkModeCssRule: AnalyzerRule = {
  id: 'dark-mode',
  guideId: 'dark-mode',
  guideHash: DARK_MODE_GUIDE_HASH,
  summary:
    'Stylesheets overriding colors in @media (prefers-color-scheme: dark) without color-scheme should use color-scheme: light dark and light-dark().',
  matcher: darkModeCssMatcher,
  verifierRubric: {
    keepWhen: [
      'CSS rules duplicate theme properties inside @media (prefers-color-scheme: dark) without declaring color-scheme: light dark or using light-dark() CSS color tokens.',
      'Component styles override foreground, background, or border colors within prefers-color-scheme media blocks without root color-scheme enablement.',
    ],
    dropWhen: [
      'The stylesheet already declares color-scheme: light dark on :root, html, or container elements.',
      'The stylesheet utilizes light-dark() color functions for automatic color switching.',
      'The media query is inside an external print stylesheet or handles high-contrast forced-colors mode overrides.',
    ],
  },
};

export default [
  darkModeCssRule,
] satisfies readonly AnalyzerRule[];
