import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isLibraryReference,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DependencyRuleMatcher,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CROSS_DOCUMENT_TRANSITIONS_GUIDE_HASH = '9ce01549680c';

const PAGE_TRANSITION_PACKAGES = [
  'barba.js',
  'swup',
  'smoothstate',
] as const;

const PAGE_TRANSITION_FAST_TOKENS = [
  'barba',
  'Barba',
  'Swup',
  'swup',
  'smoothState',
] as const;

const PAGE_TRANSITION_GUARD_TOKENS = [
  '@view-transition',
  'view-transition-old',
  'view-transition-new',
  'onpagereveal',
  'pagereveal',
] as const;

export const crossDocumentTransitionsPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    PAGE_TRANSITION_PACKAGES,
    (packageName) =>
      `MPA page-transition library "${packageName}" can be replaced with native CSS Cross-Document View Transitions (@view-transition { navigation: auto; }).`,
  );

function matchPageTransitionCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (Node.isPropertyAccessExpression(callee)) {
    const methodName = callee.getName();
    const receiver = unwrapExpression(callee.getExpression());

    // barba.init(...) or Barba.Pjax.start()
    if (
      methodName === 'init' &&
      (isLibraryReference(receiver, 'barba', ['@barba/core', 'barba.js']) ||
        isLibraryReference(receiver, 'Barba', ['@barba/core', 'barba.js']))
    ) {
      return 'barba.init() page-transition controller can be replaced with native CSS Cross-Document View Transitions (@view-transition { navigation: auto; }).';
    }

    if (
      methodName === 'start' &&
      Node.isPropertyAccessExpression(receiver) &&
      receiver.getName() === 'Pjax' &&
      isLibraryReference(unwrapExpression(receiver.getExpression()), 'Barba', [
        'barba.js',
        '@barba/core',
      ])
    ) {
      return 'Barba.Pjax.start() page-transition controller can be replaced with native CSS Cross-Document View Transitions (@view-transition { navigation: auto; }).';
    }
  }

  return null;
}

function matchPageTransitionNew(newExpr: NewExpression): string | null {
  const expr = unwrapExpression(newExpr.getExpression());

  if (isLibraryReference(expr, 'Swup', ['swup'])) {
    return 'new Swup() page-transition controller can be replaced with native CSS Cross-Document View Transitions (@view-transition { navigation: auto; }).';
  }

  return null;
}

export const crossDocumentTransitionsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: PAGE_TRANSITION_FAST_TOKENS,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    for (const guard of PAGE_TRANSITION_GUARD_TOKENS) {
      if (ctx.fileContent.includes(guard)) {
        return [];
      }
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const message = matchPageTransitionCall(callExpr);
      if (message !== null) {
        const line = callExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const message = matchPageTransitionNew(newExpr);
      if (message !== null) {
        const line = newExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    return matches;
  },
};

export const crossDocumentTransitionsDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'meta[name="view-transition"]',
  fastTokens: ['view-transition'] as const,
  matchElement(
    element: DomElementView,
    _ctx: DomMatcherContext,
  ): { message: string } | null {
    const nameAttr = (element.getAttribute('name') ?? '').trim().toLowerCase();
    if (nameAttr !== 'view-transition') {
      return null;
    }
    return {
      message:
        'Legacy <meta name="view-transition"> origin-trial tag has been replaced by the standard CSS @view-transition { navigation: auto; } at-rule.',
    };
  },
};

export const crossDocumentTransitionsPackageRule: AnalyzerRule = {
  id: 'cross-document-transitions/package-page-transition',
  guideId: 'cross-document-transitions',
  guideHash: CROSS_DOCUMENT_TRANSITIONS_GUIDE_HASH,
  summary:
    'MPA page-transition libraries (@barba/core, barba.js, swup, smoothstate) can be replaced with native CSS Cross-Document View Transitions (@view-transition { navigation: auto; }).',
  matcher: crossDocumentTransitionsPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A package.json dependency or vendored library includes @barba/core, barba.js, swup, or smoothstate to animate full-page navigations across a Multi-Page Application.',
    ],
    dropWhen: [
      'The project already uses @view-transition { navigation: auto; } in CSS.',
    ],
  },
};

export const crossDocumentTransitionsRule: AnalyzerRule = {
  id: 'cross-document-transitions',
  guideId: 'cross-document-transitions',
  guideHash: CROSS_DOCUMENT_TRANSITIONS_GUIDE_HASH,
  summary:
    'JavaScript MPA page-transition controllers (barba.init(), Barba.Pjax.start(), new Swup()) can be replaced with native CSS @view-transition { navigation: auto; }.',
  matcher: crossDocumentTransitionsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript initializes Barba.js (barba.init(), Barba.Pjax.start()) or Swup (new Swup()) to intercept same-origin MPA link navigations and animate page transitions.',
    ],
    dropWhen: [
      'The codebase already uses native CSS @view-transition { navigation: auto; } or pagereveal listeners.',
      'The transition is an intra-page SPA component state change rather than a cross-document page navigation.',
    ],
  },
};

export const crossDocumentTransitionsDomRule: AnalyzerRule = {
  id: 'cross-document-transitions/dom-meta',
  guideId: 'cross-document-transitions',
  guideHash: CROSS_DOCUMENT_TRANSITIONS_GUIDE_HASH,
  summary:
    'Legacy <meta name="view-transition" content="same-origin"> tags should be migrated to the standard CSS @view-transition { navigation: auto; } at-rule.',
  matcher: crossDocumentTransitionsDomMatcher,
  verifierRubric: {
    keepWhen: [
      'HTML markup declares a legacy <meta name="view-transition" content="same-origin"> origin-trial element instead of the standard @view-transition { navigation: auto; } CSS at-rule.',
    ],
    dropWhen: [
      'The meta element is unrelated to view transitions.',
    ],
  },
};

export default [
  crossDocumentTransitionsPackageRule,
  crossDocumentTransitionsRule,
  crossDocumentTransitionsDomRule,
] satisfies readonly AnalyzerRule[];
