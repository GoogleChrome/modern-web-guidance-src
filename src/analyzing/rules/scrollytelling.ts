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
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLLYTELLING_GUIDE_HASH = '5145c9eeaad8';

const SCROLLYTELLING_PACKAGES = [
  'scrollama',
  'scrollmagic',
  'scroll-timeline-polyfill',
] as const;

const SCROLLYTELLING_FAST_TOKENS = [
  'scrollama',
  'ScrollMagic',
  'intersectionRatio',
] as const;

const SCROLLYTELLING_GUARD_TOKENS = [
  'view-timeline',
  'viewTimeline',
  'animation-timeline',
  'animationTimeline',
  'timeline-scope',
  'timelineScope',
  'ViewTimeline',
  'ScrollTimeline',
] as const;

export const scrollytellingPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    SCROLLYTELLING_PACKAGES,
    (packageName) =>
      `Scrollytelling / scroll-driven animation dependency "${packageName}" can be replaced with native CSS Scroll-Driven Animations (view-timeline, timeline-scope, animation-timeline, and animation-range).`,
  );

function hasDenseThresholdArray(optionsNode: Node | undefined): boolean {
  if (!optionsNode) {
    return false;
  }
  const text = optionsNode.getText();
  if (!/\bthreshold\s*:/.test(text)) {
    return false;
  }
  // Matches Array.from({ length: ... }) or an array literal with >= 4 numeric steps
  if (/\bArray\.from\s*\(/.test(text) || /\bnew\s+Array\s*\(/.test(text)) {
    return true;
  }
  const arrayMatch = text.match(/threshold\s*:\s*\[([^\]]+)\]/);
  if (arrayMatch && arrayMatch[1]) {
    const items = arrayMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    return items.length >= 4;
  }
  return false;
}

function callbackDrivesContinuousVisualStyle(callbackNode: Node | undefined): boolean {
  if (!callbackNode) {
    return false;
  }
  const text = callbackNode.getText();
  if (!text.includes('intersectionRatio')) {
    return false;
  }
  return (
    /\.style\.(?:transform|opacity|translate|scale|rotate)\b/.test(text) ||
    /\.style\.setProperty\s*\(\s*['"]--/.test(text)
  );
}

function matchScrollytellingCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (isLibraryReference(callee, 'scrollama', ['scrollama'])) {
    return 'scrollama() scrollytelling controller can be replaced with native CSS Scroll-Driven Animations (view-timeline, timeline-scope, and animation-timeline).';
  }

  return null;
}

function matchScrollytellingNew(newExpr: NewExpression): string | null {
  const expr = unwrapExpression(newExpr.getExpression());

  // new ScrollMagic.Scene(...) or new ScrollMagic.Controller(...)
  if (
    Node.isPropertyAccessExpression(expr) &&
    (expr.getName() === 'Scene' || expr.getName() === 'Controller')
  ) {
    const receiver = unwrapExpression(expr.getExpression());
    if (isLibraryReference(receiver, 'ScrollMagic', ['scrollmagic'])) {
      // If both Controller and Scene are in the file, prefer flagging Scene or Controller once per line
      return `new ScrollMagic.${expr.getName()}() scrollytelling controller can be replaced with native CSS Scroll-Driven Animations (view-timeline, timeline-scope, and animation-timeline).`;
    }
  }

  // new IntersectionObserver((entries) => { ... entry.intersectionRatio ... style.transform/opacity ... }, { threshold: [...] })
  if (expr.getText() === 'IntersectionObserver' || expr.getText() === 'window.IntersectionObserver') {
    const args = newExpr.getArguments();
    const callbackArg = args[0];
    const optionsArg = args[1];
    if (
      callbackDrivesContinuousVisualStyle(callbackArg) &&
      hasDenseThresholdArray(optionsArg)
    ) {
      return 'Multi-threshold IntersectionObserver driving continuous style transforms/opacity via intersectionRatio can be replaced with CSS Scroll-Driven Animations (view-timeline, timeline-scope, and animation-timeline).';
    }
  }

  return null;
}

export const scrollytellingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: SCROLLYTELLING_FAST_TOKENS,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    for (const guard of SCROLLYTELLING_GUARD_TOKENS) {
      if (ctx.fileContent.includes(guard)) {
        return [];
      }
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const message = matchScrollytellingCall(callExpr);
      if (message !== null) {
        const line = callExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const message = matchScrollytellingNew(newExpr);
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

export const scrollytellingPackageRule: AnalyzerRule = {
  id: 'scrollytelling/package-scrollytelling',
  guideId: 'scrollytelling',
  guideHash: SCROLLYTELLING_GUIDE_HASH,
  summary:
    'Scrollytelling dependencies (scrollama, scrollmagic, scroll-timeline-polyfill) can be replaced with native CSS Scroll-Driven Animations (view-timeline, timeline-scope, animation-timeline).',
  matcher: scrollytellingPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A package.json dependency or vendored library includes scrollama, scrollmagic, or scroll-timeline-polyfill to drive scroll-linked animations across narrative sections.',
    ],
    dropWhen: [
      'The codebase already uses native CSS view-timeline, timeline-scope, and animation-timeline with @supports feature detection.',
    ],
  },
};

export const scrollytellingRule: AnalyzerRule = {
  id: 'scrollytelling',
  guideId: 'scrollytelling',
  guideHash: SCROLLYTELLING_GUIDE_HASH,
  summary:
    'JavaScript scrollytelling controllers (scrollama(), ScrollMagic.Scene, or multi-threshold IntersectionObserver interpolating transform/opacity via intersectionRatio) can be replaced with CSS view-timeline, timeline-scope, and animation-timeline.',
  matcher: scrollytellingJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript initializes scrollama(), ScrollMagic.Scene/Controller, or a multi-threshold IntersectionObserver reading entry.intersectionRatio to continuously interpolate transform or opacity on animated stage elements as sections scroll.',
    ],
    dropWhen: [
      'The code is a Progressive Enhancement fallback gated behind @supports or CSS.supports("animation-timeline: scroll()") for browsers without scroll-driven animations.',
      'The IntersectionObserver only toggles a discrete class or triggers lazy loading / infinite scroll at a single threshold (covered by scroll-entry-exit-effects or scrollspy).',
    ],
  },
};

export default [
  scrollytellingPackageRule,
  scrollytellingRule,
] satisfies readonly AnalyzerRule[];
