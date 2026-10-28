import {
  Node,
  SyntaxKind,
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

export const FASTER_SPA_VIEW_TRANSITIONS_GUIDE_HASH = 'ae77586b53ca';

const CONTENT_VISIBILITY_GUARD_TOKENS = [
  'content-visibility',
  'contentVisibility',
] as const;

const SPA_VIEW_INACTIVE_SELECTOR_RE =
  /(?:^|[\s>+~])(?:\.(?:spa-view|app-view|page-view|route-view|screen-view|view-pane|view-panel|view-container)|\[data-(?:view|page|screen|route)(?:=[^\]]*)?\])(?:\.(?:inactive|is-inactive|is-hidden|hidden)|:not\(\.(?:active|is-active|current)\)|\[aria-hidden=["']true["']\])/i;

const VIEW_QUERY_SELECTOR_RE =
  /(?:\.(?:spa-view|app-view|page-view|route-view|screen-view|view-pane|view-panel|view-container|view\b)|\[data-(?:view|screen|route)\])/i;

export const fasterSpaViewTransitionsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [
    'spa-view',
    'app-view',
    'page-view',
    'route-view',
    'screen-view',
    'view-pane',
    'view-panel',
    'view-container',
    'data-view',
    'data-page',
    'data-screen',
    'data-route',
  ],
  matchRule(
    styleRule: CssRuleView,
    ctx: CssMatcherContext,
  ): { message: string } | null {
    if (ctx.stylesheetHasProperty('content-visibility')) {
      return null;
    }
    if (
      styleRule.parentAtRule &&
      /^(?:@supports|@media\s+print)/i.test(styleRule.parentAtRule.trim())
    ) {
      return null;
    }
    if (!SPA_VIEW_INACTIVE_SELECTOR_RE.test(styleRule.selectorText)) {
      return null;
    }
    const displayVal = styleRule.getPropertyValue('display')?.trim().toLowerCase();
    if (displayVal !== 'none' && !displayVal?.startsWith('none ')) {
      return null;
    }
    return {
      message: `Inactive SPA view selector '${styleRule.selectorText}' uses display: none, which discards cached layout and paint state; use content-visibility: hidden on inactive views (with an @supports not (content-visibility: hidden) fallback) to preserve rendered state for instant view switching.`,
    };
  },
};

export const fasterSpaViewTransitionsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    '.spa-view',
    '.app-view',
    '.page-view',
    '.route-view',
    '.screen-view',
    '.view-pane',
    '.view-panel',
    '.view-container',
    ".view'",
    '.view"',
    '[data-view',
    '[data-screen',
    '[data-route',
  ],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (
      ctx.fileContent.includes('content-visibility') ||
      ctx.fileContent.includes('contentVisibility')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ];

    for (const fn of functions) {
      if (fn.getText().length > 3500) {
        continue;
      }
      let queriesViews = false;
      let displayNoneNode: Node | null = null;

      fn.forEachDescendant((child) => {
        if (Node.isCallExpression(child)) {
          const expr = unwrapExpression(child.getExpression());
          if (
            Node.isPropertyAccessExpression(expr) &&
            expr.getName() === 'querySelectorAll'
          ) {
            const arg0 = child.getArguments()[0];
            if (
              arg0 &&
              Node.isStringLiteral(arg0) &&
              VIEW_QUERY_SELECTOR_RE.test(arg0.getLiteralText())
            ) {
              queriesViews = true;
            }
          }
        }

        if (
          Node.isBinaryExpression(child) &&
          child.getOperatorToken().getKind() === SyntaxKind.EqualsToken
        ) {
          const left = unwrapExpression(child.getLeft());
          const right = unwrapExpression(child.getRight());
          if (Node.isPropertyAccessExpression(left)) {
            const leftObj = left.getExpression();
            if (
              left.getName() === 'display' &&
              Node.isPropertyAccessExpression(leftObj) &&
              leftObj.getName() === 'style' &&
              Node.isStringLiteral(right) &&
              right.getLiteralText() === 'none'
            ) {
              displayNoneNode ??= child;
            }
          }
        }
      });

      if (
        queriesViews &&
        displayNoneNode &&
        !isProtectedByFeatureGuard(displayNoneNode, CONTENT_VISIBILITY_GUARD_TOKENS)
      ) {
        const target: Node = displayNoneNode;
        matches.push({
          line: target.getStartLineNumber(),
          message:
            "SPA view switcher hides inactive views via style.display = 'none', forcing full layout and paint recalculation on return; toggle a CSS class with content-visibility: hidden and aria-hidden='true' to retain cached rendering state across view transitions.",
        });
      }
    }

    return matches;
  },
};

export const fasterSpaViewTransitionsCssRule: AnalyzerRule = {
  id: 'faster-spa-view-transitions/css',
  guideId: 'faster-spa-view-transitions',
  guideHash: FASTER_SPA_VIEW_TRANSITIONS_GUIDE_HASH,
  summary:
    'Inactive SPA view CSS rules using display: none should use content-visibility: hidden to retain cached layout and paint state across view transitions.',
  matcher: fasterSpaViewTransitionsCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS selector targeting inactive SPA views or route panes uses display: none instead of content-visibility: hidden.',
    ],
    dropWhen: [
      '@supports not (content-visibility: hidden) fallback blocks that provide display: none for unsupported browsers.',
      'Small UI widgets (dropdowns, tooltips, modals, or form error banners) where display: none is appropriate.',
    ],
  },
};

export const fasterSpaViewTransitionsRule: AnalyzerRule = {
  id: 'faster-spa-view-transitions',
  guideId: 'faster-spa-view-transitions',
  guideHash: FASTER_SPA_VIEW_TRANSITIONS_GUIDE_HASH,
  summary:
    "SPA view switchers hiding inactive views with style.display = 'none' should toggle content-visibility: hidden to preserve cached rendering state.",
  matcher: fasterSpaViewTransitionsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A bounded SPA view or route-pane switcher hides inactive view containers using style.display = "none", forcing the browser to recalculate layout and paint when switching back instead of caching rendering state with content-visibility: hidden.',
    ],
    dropWhen: [
      'Small UI widgets (dropdowns, tooltips, modals, or form error banners) where display: none or [hidden] is appropriate and layout caching provides no benefit.',
      'Unbounded dynamic route caches where retaining every historical view in DOM memory would cause RAM bloat.',
    ],
  },
};

export default [
  fasterSpaViewTransitionsRule,
  fasterSpaViewTransitionsCssRule,
] satisfies readonly AnalyzerRule[];
