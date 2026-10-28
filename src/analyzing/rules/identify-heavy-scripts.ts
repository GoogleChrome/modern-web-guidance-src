import {
  Node,
  SyntaxKind,
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
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const IDENTIFY_HEAVY_SCRIPTS_GUIDE_HASH = '21db2cd6f50c';

const LOAF_GUARD_TOKENS = [
  'long-animation-frame',
  'PerformanceLongAnimationFrameTiming',
] as const;

function getPropertyKeyName(prop: Node): string | null {
  if (!Node.isPropertyAssignment(prop)) {
    return null;
  }
  const nameNode = prop.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }
  return null;
}

function isPerformanceObserverInstance(receiver: Node, sourceFile: SourceFile): boolean {
  const resolved = resolveLocalExpression(receiver, 2);
  if (Node.isNewExpression(resolved)) {
    return isGlobalReference(resolved.getExpression(), 'PerformanceObserver');
  }
  if (resolved !== unwrapExpression(receiver)) {
    return false;
  }
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.NewExpression)
    .some((n) => isGlobalReference(n.getExpression(), 'PerformanceObserver'));
}

function observesLongTask(optionsNode: Node): boolean {
  const resolved = resolveLocalExpression(optionsNode, 2);
  if (!Node.isObjectLiteralExpression(resolved)) {
    return false;
  }

  for (const prop of resolved.getProperties()) {
    const key = getPropertyKeyName(prop);
    if (!key || !Node.isPropertyAssignment(prop)) {
      continue;
    }
    const init = resolveLocalExpression(prop.getInitializerOrThrow(), 2);

    if (
      key === 'type' &&
      (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init)) &&
      init.getLiteralText().trim() === 'longtask'
    ) {
      return true;
    }

    if (key === 'entryTypes' && Node.isArrayLiteralExpression(init)) {
      const elements = init.getElements();
      let hasLongTask = false;
      let hasLoaf = false;
      for (const el of elements) {
        const unwrapped = unwrapExpression(el);
        if (
          Node.isStringLiteral(unwrapped) ||
          Node.isNoSubstitutionTemplateLiteral(unwrapped)
        ) {
          const text = unwrapped.getLiteralText().trim();
          if (text === 'longtask') {
            hasLongTask = true;
          } else if (text === 'long-animation-frame') {
            hasLoaf = true;
          }
        }
      }
      if (hasLongTask && !hasLoaf) {
        return true;
      }
    }
  }

  return false;
}

function matchLongTaskObserveCall(
  callExpr: CallExpression,
  sourceFile: SourceFile,
): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== 'observe') {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  if (!observesLongTask(args[0]!)) {
    return null;
  }

  if (!isPerformanceObserverInstance(expr.getExpression(), sourceFile)) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, LOAF_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      "PerformanceObserver observing 'longtask' provides limited script attribution; use { type: 'long-animation-frame', buffered: true } (Long Animation Frames API) to identify heavy-running scripts.",
  };
}

export const identifyHeavyScriptsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['longtask'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const content = ctx.fileContent;
    if (
      content.includes('long-animation-frame') ||
      content.includes('____lastLongTask') ||
      content.includes('____lhPerformanceObserver')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const match = matchLongTaskObserveCall(callExpr, sourceFile);
      if (match) {
        matches.push(match);
      }
    }
    return matches;
  },
};

export const identifyHeavyScriptsRule: AnalyzerRule = {
  id: 'identify-heavy-scripts',
  guideId: 'identify-heavy-scripts',
  guideHash: IDENTIFY_HEAVY_SCRIPTS_GUIDE_HASH,
  summary:
    "Upgrade PerformanceObserver observing 'longtask' to the Long Animation Frames API ('long-animation-frame') for detailed script attribution.",
  matcher: identifyHeavyScriptsMatcher,
  verifierRubric: {
    keepWhen: [
      "A PerformanceObserver calls .observe({ type: 'longtask' }) or .observe({ entryTypes: ['longtask'] }) to monitor or attribute main-thread responsiveness, slow frames, or heavy scripts without observing 'long-animation-frame'.",
    ],
    dropWhen: [
      "The file already observes 'long-animation-frame' or guards the 'longtask' observer as a fallback when PerformanceLongAnimationFrameTiming is unsupported.",
      'Headless browser automation harnesses (such as Lighthouse waitForCPUIdle) that only track idle timestamps rather than attributing slow frames or heavy scripts.',
    ],
  },
};

export default [
  identifyHeavyScriptsRule,
] satisfies readonly AnalyzerRule[];
