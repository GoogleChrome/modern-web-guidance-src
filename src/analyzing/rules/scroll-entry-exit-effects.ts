import {
  Node,
  type CallExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
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

function isLibraryInstance(
  node: Node,
  identName: string,
  packages: readonly string[],
): boolean {
  const resolved = resolveLocalExpression(node, 2);
  return (
    (Node.isCallExpression(resolved) || Node.isNewExpression(resolved)) &&
    isLibraryReference(unwrapExpression(resolved.getExpression()), identName, packages)
  );
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

  if (methodName === 'reveal' && isLibraryInstance(receiver, 'ScrollReveal', ['scrollreveal'])) {
    return 'ScrollReveal().reveal() scroll animation can be modernized with CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).';
  }

  if (methodName === 'init' && isLibraryInstance(receiver, 'WOW', ['wowjs', 'wow.js'])) {
    return 'new WOW().init() scroll reveal initialization can be modernized with CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).';
  }

  return null;
}

export const scrollEntryExitEffectsPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    SCROLL_REVEAL_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy scroll-reveal package "${pkgName}" (${versionRange}) can be modernized with native CSS Scroll-Driven Animations (animation-timeline: view() and animation-range: entry, exit).`,
  );

export const scrollEntryExitEffectsJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['AOS.init', 'ScrollReveal', 'new WOW'],
  featureGuardTokens: SCROLL_TIMELINE_GUARD_TOKENS,
  matchCall: matchScrollRevealCall,
});

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

export default [
  scrollEntryExitEffectsPackageRule,
  scrollEntryExitEffectsJsRule,
] satisfies readonly AnalyzerRule[];
