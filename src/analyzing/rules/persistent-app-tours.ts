import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isLibraryReference,
  resolveLocalExpression,
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

export const PERSISTENT_APP_TOURS_GUIDE_HASH = '42fa5d633ef1';

const TOUR_PACKAGES = [
  'shepherd.js',
  'driver.js',
  'bootstrap-tour',
  'react-joyride',
] as const;

const TOUR_FAST_TOKENS = [
  'introJs',
  'intro.js',
  'Shepherd',
  'shepherd.js',
  'driver',
  'driver.js',
  'bootstrap-tour',
] as const;

const TOUR_GUARD_TOKENS = [
  'popover="manual"',
  "popover='manual'",
  'position-anchor',
  'positionAnchor',
  'anchor-name',
  'anchorName',
] as const;

export const persistentAppToursPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    TOUR_PACKAGES,
    (packageName) =>
      `Third-party onboarding tour dependency "${packageName}" can be replaced with native HTML popover="manual" and CSS Anchor Positioning.`,
  );

function isChainedIntroJsCall(callExpr: CallExpression): boolean {
  const parent = callExpr.getParent();
  if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === callExpr) {
    const grandParent = parent.getParent();
    if (grandParent && Node.isCallExpression(grandParent)) {
      return true;
    }
  }
  return false;
}

function hasDriverStepsConfig(argNode: Node | undefined): boolean {
  if (!argNode) {
    return false;
  }
  const resolved = resolveLocalExpression(argNode, 2);
  if (!Node.isObjectLiteralExpression(resolved)) {
    return false;
  }
  const stepsProp = resolved.getProperty('steps');
  if (!stepsProp || !Node.isPropertyAssignment(stepsProp)) {
    return false;
  }
  const stepsInit = stepsProp.getInitializer();
  if (!stepsInit) {
    return false;
  }
  const stepsResolved = resolveLocalExpression(stepsInit, 2);
  if (!Node.isArrayLiteralExpression(stepsResolved)) {
    return true;
  }
  return stepsResolved.getElements().some((el) => {
    const elResolved = resolveLocalExpression(el, 2);
    if (!Node.isObjectLiteralExpression(elResolved)) {
      return false;
    }
    return (
      Boolean(elResolved.getProperty('element')) ||
      Boolean(elResolved.getProperty('popover'))
    );
  });
}

function isModalOrStateMachineIntroTour(callExpr: CallExpression): boolean {
  const callText = callExpr.getText();
  if (
    /disableInteraction\s*:\s*true/.test(callText) ||
    /\.(?:onbeforechange|onafterchange|onchange)\s*\(/.test(callText)
  ) {
    return true;
  }
  return false;
}

function matchTourCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  // 1. introJs() or introJs().setOptions(...).start()
  if (isLibraryReference(callee, 'introJs', ['intro.js'])) {
    if (isChainedIntroJsCall(callExpr) || isModalOrStateMachineIntroTour(callExpr)) {
      return null;
    }
    return 'Intro.js onboarding tour call introJs() can be replaced with native HTML popover="manual" and CSS Anchor Positioning.';
  }

  // 2. Chained call like introJs().start() or introJs().setOptions(...)
  if (Node.isPropertyAccessExpression(callee)) {
    let rootExpr: Node = unwrapExpression(callee.getExpression());
    while (Node.isCallExpression(rootExpr)) {
      const innerCallee = unwrapExpression(rootExpr.getExpression());
      if (isLibraryReference(innerCallee, 'introJs', ['intro.js'])) {
        if (isChainedIntroJsCall(callExpr) || isModalOrStateMachineIntroTour(callExpr)) {
          return null;
        }
        return 'Intro.js onboarding tour call introJs() can be replaced with native HTML popover="manual" and CSS Anchor Positioning.';
      }
      if (Node.isPropertyAccessExpression(innerCallee)) {
        rootExpr = unwrapExpression(innerCallee.getExpression());
      } else {
        break;
      }
    }
  }

  // 3. driver({ steps: [...] }) from driver.js
  if (isLibraryReference(callee, 'driver', ['driver.js'])) {
    const firstArg = callExpr.getArguments()[0];
    if (
      hasDriverStepsConfig(firstArg) ||
      callExpr.getSourceFile().getFullText().includes('driver.js')
    ) {
      return 'Driver.js onboarding tour call driver() can be replaced with native HTML popover="manual" and CSS Anchor Positioning.';
    }
  }

  return null;
}

function matchTourNew(newExpr: NewExpression): string | null {
  const expr = unwrapExpression(newExpr.getExpression());

  // new Shepherd.Tour(...)
  if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'Tour') {
    const receiver = unwrapExpression(expr.getExpression());
    if (isLibraryReference(receiver, 'Shepherd', ['shepherd.js'])) {
      return 'Shepherd.js tour instance new Shepherd.Tour() can be replaced with native HTML popover="manual" and CSS Anchor Positioning.';
    }
  }

  // new Tour({ steps: [...] }) from shepherd.js or bootstrap-tour
  if (isLibraryReference(expr, 'Tour', ['shepherd.js', 'bootstrap-tour'])) {
    const firstArg = newExpr.getArguments()[0];
    if (
      hasDriverStepsConfig(firstArg) ||
      newExpr.getSourceFile().getFullText().includes('shepherd') ||
      newExpr.getSourceFile().getFullText().includes('bootstrap-tour')
    ) {
      return 'JavaScript onboarding Tour instance can be replaced with native HTML popover="manual" and CSS Anchor Positioning.';
    }
  }

  // new Driver(...)
  if (isLibraryReference(expr, 'Driver', ['driver.js'])) {
    const firstArg = newExpr.getArguments()[0];
    if (
      hasDriverStepsConfig(firstArg) ||
      newExpr.getSourceFile().getFullText().includes('driver.js')
    ) {
      return 'Driver.js onboarding tour instance new Driver() can be replaced with native HTML popover="manual" and CSS Anchor Positioning.';
    }
  }

  return null;
}

export const persistentAppToursJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: TOUR_FAST_TOKENS,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    for (const guard of TOUR_GUARD_TOKENS) {
      if (ctx.fileContent.includes(guard)) {
        return [];
      }
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const message = matchTourCall(callExpr);
      if (message !== null) {
        const line = callExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const message = matchTourNew(newExpr);
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

export const persistentAppToursPackageRule: AnalyzerRule = {
  id: 'persistent-app-tours/package-tour',
  guideId: 'persistent-app-tours',
  guideHash: PERSISTENT_APP_TOURS_GUIDE_HASH,
  summary:
    'Third-party onboarding tour libraries (intro.js, shepherd.js, driver.js, bootstrap-tour, react-joyride) can be replaced with native HTML popover="manual" and CSS Anchor Positioning.',
  matcher: persistentAppToursPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A package.json dependency or vendored library imports intro.js, shepherd.js, driver.js, bootstrap-tour, or react-joyride for product tours and step-by-step onboarding callouts.',
    ],
    dropWhen: [
      'The package is unrelated to UI onboarding walkthroughs or tethered tour popovers (e.g., database drivers or hardware device drivers).',
    ],
  },
};

export const persistentAppToursRule: AnalyzerRule = {
  id: 'persistent-app-tours',
  guideId: 'persistent-app-tours',
  guideHash: PERSISTENT_APP_TOURS_GUIDE_HASH,
  summary:
    'JavaScript onboarding tour initialization (introJs(), new Shepherd.Tour(), driver()) can be replaced with native HTML popover="manual" and CSS Anchor Positioning.',
  matcher: persistentAppToursJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript initializes a persistent onboarding tour or walkthrough (such as introJs(), new Shepherd.Tour(), or driver({ steps })) that tethers persistent floating callouts to page elements while users interact with the UI.',
    ],
    dropWhen: [
      'The code already uses native HTML popover="manual" with CSS Anchor Positioning (anchor-name / position-anchor).',
      'Modal spotlight tours that explicitly block user interaction with highlighted elements (disableInteraction: true) or rely on step-transition DOM mutation hooks (onbeforechange / onafterchange).',
      'The call is a database, WebDriver, or hardware driver unrelated to UI onboarding tours.',
    ],
  },
};

export default [
  persistentAppToursPackageRule,
  persistentAppToursRule,
] satisfies readonly AnalyzerRule[];
