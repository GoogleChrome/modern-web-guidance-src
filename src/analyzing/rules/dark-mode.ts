import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  JsMatcherContext,
  JsRuleMatcher,
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

function isPrefersColorSchemeCall(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  let methodName = '';
  if (Node.isPropertyAccessExpression(expr)) {
    methodName = expr.getName();
  } else if (Node.isIdentifier(expr)) {
    methodName = expr.getText();
  }
  if (methodName !== 'matchMedia') {
    return false;
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return false;
  }
  const firstArg = unwrapExpression(args[0] as Node);
  if (!Node.isStringLiteral(firstArg)) {
    return false;
  }
  const query = firstArg.getLiteralText().toLowerCase();
  return query.includes('prefers-color-scheme') && query.includes('dark');
}

const darkModeJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['matchMedia', 'prefers-color-scheme'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    const content = ctx.fileContent;
    const hasChangeListener =
      content.includes("addEventListener('change'") ||
      content.includes('addEventListener("change"') ||
      content.includes('.addListener(');

    // Check actual color-scheme property or property access, avoiding query literal (J-1)
    const hasColorScheme =
      /(?:\.style\.colorScheme|\bcolor-scheme\s*:)/i.test(content);

    // Skip user-override toggles like localStorage/sessionStorage/cookies (J-2)
    const hasStorageOverride =
      content.includes('localStorage') ||
      content.includes('sessionStorage') ||
      content.includes('document.cookie');
    if (hasStorageOverride) {
      return matches;
    }

    const togglesDarkTheme =
      content.includes('dark') &&
      (content.includes('classList') ||
        content.includes('className') ||
        content.includes('setAttribute'));

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (!isPrefersColorSchemeCall(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, ['color-scheme', 'light-dark'])) {
        return;
      }

      const lacksListener = !hasChangeListener;
      const togglesThemeWithoutColorScheme = togglesDarkTheme && !hasColorScheme;

      if (!lacksListener && !togglesThemeWithoutColorScheme) {
        return;
      }

      const line = node.getStartLineNumber();
      if (!visitedLines.has(line)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'JavaScript matchMedia(prefers-color-scheme) reads dark mode without a change listener or to toggle theme classes; modernize with CSS color-scheme: light dark and light-dark().',
        });
      }
    });

    return matches;
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

export const darkModeJsMatchMediaRule: AnalyzerRule = {
  id: 'dark-mode/js-match-media',
  guideId: 'dark-mode',
  guideHash: DARK_MODE_GUIDE_HASH,
  summary:
    'JavaScript matchMedia reading dark mode without dynamic listeners or to toggle theme classes should use declarative CSS color-scheme.',
  matcher: darkModeJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript uses matchMedia("(prefers-color-scheme: dark)") to read system theme state once at load without registering a change listener for dynamic theme updates.',
      'JavaScript imperatively toggles .dark or data-theme="dark" classes on documentElement or body based on system preference instead of declarative color-scheme: light dark.',
    ],
    dropWhen: [
      'The script registers a change event listener (or .addListener) on the MediaQueryList to handle real-time system theme updates and user theme overrides.',
      'The application integrates a full user-controlled theme picker with persisted localStorage overrides that coordinates with color-scheme meta tags.',
      'The matchMedia call is part of an analytics or system diagnostics payload rather than driving UI theme styles.',
    ],
  },
};

export const darkModeRules: readonly AnalyzerRule[] = [
  darkModeCssRule,
  darkModeJsMatchMediaRule,
];
