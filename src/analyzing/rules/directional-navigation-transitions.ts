import { SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const DIRECTIONAL_NAVIGATION_TRANSITIONS_GUIDE_HASH = '92bdd007f1c0';

const ROOT_MUTATION_RE =
  /\b(?:document\.documentElement|document\.body|html|root\w*)\s*\.\s*(?:classList\s*\.\s*(?:add|remove|toggle)|setAttribute|removeAttribute|dataset\s*\.\s*(?:direction|transition|navDirection))/;

const DIRECTIONAL_TOKEN_RE =
  /\b(back|backward|backwards|forward|forwards|next|prev|previous|slide-left|slide-right|slide-next|slide-prev|to-left|to-right|from-left|from-right|direction|navDirection)\b/i;

const THEME_EXCLUSION_RE =
  /\b(applyTheme|newTheme|currentTheme|themeToggle|colorScheme)\b/i;

function isStartViewTransitionCall(call: CallExpression): boolean {
  const expr = call.getExpression();
  const text = expr.getText();
  return text === 'document.startViewTransition';
}

function alreadyUsesTypesOption(call: CallExpression): boolean {
  const firstArg = call.getArguments()[0];
  if (!firstArg) return false;
  return /\btypes\s*:/.test(firstArg.getText());
}

export const directionalNavigationTransitionsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['startViewTransition'] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (ctx.fileContent.includes('active-view-transition-type')) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (!isStartViewTransitionCall(call)) continue;
      if (alreadyUsesTypesOption(call)) continue;

      const enclosingFn =
        call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
        call.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ??
        call.getFirstAncestorByKind(SyntaxKind.FunctionExpression) ??
        call.getFirstAncestorByKind(SyntaxKind.ArrowFunction);

      const scopeNode = enclosingFn ?? sourceFile;
      const scopeText = scopeNode.getText();

      if (THEME_EXCLUSION_RE.test(scopeText)) {
        continue;
      }

      if (
        ROOT_MUTATION_RE.test(scopeText) &&
        DIRECTIONAL_TOKEN_RE.test(scopeText)
      ) {
        const line = call.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({
            line,
            column: call.getStartLinePos(),
            message:
              'Manual directional class or data-* attribute toggled on <html> around document.startViewTransition(); pass { update, types: [...] } and scope CSS with :active-view-transition-type().',
          });
        }
      }
    }

    return matches;
  },
};

const CSS_DIRECTIONAL_VT_SELECTOR_RE =
  /(?:html|:root)(?:\[\s*data-(?:transition|direction|nav-direction)\s*=\s*['"]?(?:forwards?|backwards?|back|next|prev|previous|left|right|slide-left|slide-right)['"]?\s*\]|\.(?:forwards?|backwards?|back|next|prev|previous|slide-left|slide-right|nav-forward|nav-back))[^{]*::view-transition-(?:old|new|group)\s*\(/i;

export const directionalNavigationTransitionsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['::view-transition-'] as const,
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    if (ctx.stylesheetText.includes(':active-view-transition-type')) {
      return null;
    }

    if (!CSS_DIRECTIONAL_VT_SELECTOR_RE.test(styleRule.selectorText)) {
      return null;
    }

    // Report only on the first directional view-transition rule in the stylesheet
    if (ctx.styleRules) {
      const firstRule = ctx.styleRules.find((r) =>
        CSS_DIRECTIONAL_VT_SELECTOR_RE.test(r.selectorText),
      );
      if (firstRule && firstRule !== styleRule) {
        return null;
      }
    }

    return {
      message:
        'Directional class or data-* attribute on <html> scoping ::view-transition-* rules; use View Transition types and html:active-view-transition-type() instead.',
    };
  },
};

export const directionalNavigationTransitionsRule: AnalyzerRule = {
  id: 'directional-navigation-transitions',
  guideId: 'directional-navigation-transitions',
  guideHash: DIRECTIONAL_NAVIGATION_TRANSITIONS_GUIDE_HASH,
  summary:
    'Detects manual directional classes or data-* attributes added/removed on <html> around document.startViewTransition() instead of passing View Transition types and using :active-view-transition-type().',
  matcher: directionalNavigationTransitionsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript adding a directional class or data-* attribute (e.g., back, forward, next, prev, data-direction) to document.documentElement before document.startViewTransition() and removing it when finished',
    ],
    dropWhen: [
      'Code already passing { update, types: [...] } to document.startViewTransition()',
      'Theme toggle (dark/light mode) transition without directional navigation state',
    ],
  },
};

export const directionalNavigationTransitionsCssRule: AnalyzerRule = {
  id: 'directional-navigation-transitions/css',
  guideId: 'directional-navigation-transitions',
  guideHash: DIRECTIONAL_NAVIGATION_TRANSITIONS_GUIDE_HASH,
  summary:
    'Detects CSS ::view-transition-old/new rules scoped via directional classes or data-transition/data-direction attributes on <html> instead of html:active-view-transition-type().',
  matcher: directionalNavigationTransitionsCssMatcher,
  verifierRubric: {
    keepWhen: [
      'CSS selectors on html or :root using directional classes or data-transition/data-direction attributes (forwards, backwards, back, next, prev) to style ::view-transition-old or ::view-transition-new',
    ],
    dropWhen: [
      'Stylesheet already using :active-view-transition-type()',
      'Theme toggle selectors (.dark::view-transition-new(root) or .light::view-transition-old(root))',
    ],
  },
};

export default [
  directionalNavigationTransitionsRule,
  directionalNavigationTransitionsCssRule,
] satisfies readonly AnalyzerRule[];
