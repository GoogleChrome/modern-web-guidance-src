import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLL_ENTRY_EXIT_EFFECTS_GUIDE_HASH = '72311e501787';

const SCROLL_REVEAL_PACKAGES = [
  'aos',
  'scrollreveal',
  'sal.js',
  'wowjs',
] as const;

const SCROLL_TIMELINE_GUARD_TOKENS = [
  'animation-timeline',
  'view()',
  'view-timeline',
  'animation-range',
] as const;

function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
): boolean {
  if (isGlobalReference(node, identName)) {
    return true;
  }
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped) || unwrapped.getText() !== identName) {
    return false;
  }
  const sourceFile = unwrapped.getSourceFile();
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (!packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))) {
      continue;
    }
    if (
      imp.getDefaultImport()?.getText() === identName ||
      imp.getNamespaceImport()?.getText() === identName
    ) {
      return true;
    }
    for (const named of imp.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      if (local === identName) {
        return true;
      }
    }
  }
  const resolved = resolveLocalExpression(unwrapped, 2);
  if (Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    const firstArg = resolved.getArguments()[0];
    if (
      Node.isIdentifier(callee) &&
      callee.getText() === 'require' &&
      firstArg &&
      Node.isStringLiteral(firstArg)
    ) {
      const spec = firstArg.getLiteralText();
      return packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`));
    }
  }
  return false;
}

function isScrollRevealInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isCallExpression(resolved) || Node.isNewExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'ScrollReveal', ['scrollreveal'])) {
      return true;
    }
  }
  return false;
}

function isWowInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isNewExpression(resolved) || Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'WOW', ['wowjs', 'wow.js'])) {
      return true;
    }
  }
  return false;
}

function matchScrollRevealCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  const receiver = callee.getExpression();

  if (methodName === 'init' && isLibraryReference(receiver, 'AOS', ['aos'])) {
    return 'AOS.init() scroll reveal initialization can be modernized with CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).';
  }

  if (methodName === 'reveal' && isScrollRevealInstance(receiver)) {
    return 'ScrollReveal().reveal() scroll animation can be modernized with CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).';
  }

  if (methodName === 'init' && isWowInstance(receiver)) {
    return 'new WOW().init() scroll reveal initialization can be modernized with CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).';
  }

  return null;
}

export const scrollEntryExitEffectsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: SCROLL_REVEAL_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy scroll-reveal package "${pkgName}" (${versionRange}) can be modernized with native CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).`,
    };
  },
};

export const scrollEntryExitEffectsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['AOS.init', 'ScrollReveal', 'new WOW'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const msg = matchScrollRevealCall(node);
      if (msg && !isProtectedByFeatureGuard(node, SCROLL_TIMELINE_GUARD_TOKENS)) {
        matches.push({
          line: node.getStartLineNumber(),
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const scrollEntryExitEffectsPackageRule: AnalyzerRule = {
  id: 'scroll-entry-exit-effects/package-scroll-reveal',
  guideId: 'scroll-entry-exit-effects',
  guideHash: SCROLL_ENTRY_EXIT_EFFECTS_GUIDE_HASH,
  summary:
    'Legacy scroll-reveal packages (aos, scrollreveal, sal.js, wowjs) should be modernized with CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).',
  matcher: scrollEntryExitEffectsPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares aos, scrollreveal, sal.js, or wowjs in package.json dependencies to animate elements as they enter or exit the viewport during scrolling.',
    ],
    dropWhen: [
      'The animation is guarded by @supports ((animation-timeline: view()) and (animation-range: entry)) or CSS.supports("animation-timeline", "view()") as a progressive enhancement fallback.',
      'The code implements non-scroll hover, focus, or initial page-load entrance animations unrelated to scrollport entry and exit.',
    ],
  },
};

export const scrollEntryExitEffectsJsRule: AnalyzerRule = {
  id: 'scroll-entry-exit-effects/js-scroll-reveal',
  guideId: 'scroll-entry-exit-effects',
  guideHash: SCROLL_ENTRY_EXIT_EFFECTS_GUIDE_HASH,
  summary:
    'JavaScript scroll-reveal calls (AOS.init, ScrollReveal().reveal, new WOW().init) should be modernized with CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).',
  matcher: scrollEntryExitEffectsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript initializes AOS.init(), calls ScrollReveal().reveal(), or invokes new WOW().init() to trigger element entry/exit animations on scroll without a CSS.supports("animation-timeline", "view()") fallback guard.',
      'Scroll listeners or IntersectionObserver callbacks toggle reveal classes solely to fade or slide elements entering or leaving the viewport.',
    ],
    dropWhen: [
      'The JavaScript scroll-reveal logic is inside a !CSS.supports("animation-timeline", "view()") or !CSS.supports("(animation-timeline: view()) and (animation-range: entry)") fallback guard.',
      'The observer or listener performs lazy data fetching, infinite scrolling, or analytics impression tracking rather than visual entry/exit animations.',
    ],
  },
};

export const scrollEntryExitEffectsRules: readonly AnalyzerRule[] = [
  scrollEntryExitEffectsPackageRule,
  scrollEntryExitEffectsJsRule,
];
