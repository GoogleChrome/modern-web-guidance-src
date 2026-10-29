import {
  Node,
  type CallExpression,
  type ObjectLiteralExpression,
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
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const PRECISE_TEXT_ALIGNMENT_GUIDE_HASH = 'caaec69c7865';

const CAPSIZE_PACKAGES = [
  '@capsizecss/core',
  '@capsizecss/vanilla-extract',
  'capsize',
] as const;

const CAPSIZE_DEPENDENCY_PACKAGES = [
  'capsize',
] as const;

const TEXT_BOX_GUARD_TOKENS = [
  'text-box',
  'text-box-trim',
  'textBoxTrim',
  'leading-trim',
  'text-edge',
  '--cap-height-scale',
] as const;

const CAPSIZE_FUNCTIONS = [
  'createStyleObject',
  'createStyleString',
  'capsize',
] as const;

const CAPSIZE_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'fontMetrics',
  'capHeight',
  'lineGap',
  'leading',
]);

function hasCapsizeMetricsConfig(obj: ObjectLiteralExpression): boolean {
  for (const prop of obj.getProperties()) {
    if (
      (Node.isPropertyAssignment(prop) ||
        Node.isShorthandPropertyAssignment(prop)) &&
      CAPSIZE_CONFIG_KEYS.has(prop.getName())
    ) {
      return true;
    }
  }
  return false;
}

function matchCapsizeCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length === 0 || !args[0]) {
    return null;
  }

  const sf = callExpr.getSourceFile();
  if (/\.(?:native|ios|android)\.[jt]sx?$/i.test(sf.getFilePath())) {
    return null;
  }

  const sfText = sf.getFullText();
  if (TEXT_BOX_GUARD_TOKENS.some((tok) => sfText.includes(tok))) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  const matchedFn = CAPSIZE_FUNCTIONS.find((fnName) => {
    if (
      isLibraryReference(callee, fnName, CAPSIZE_PACKAGES, {
        allowDefaultImport: fnName === 'capsize',
      })
    ) {
      return true;
    }
    if (
      Node.isPropertyAccessExpression(callee) &&
      callee.getName() === fnName &&
      isLibraryReference(callee.getExpression(), 'capsize', CAPSIZE_PACKAGES)
    ) {
      return true;
    }
    return false;
  });
  if (!matchedFn) {
    return null;
  }

  const firstArg = resolveLocalExpression(args[0], 2);
  const isImportedFromPkg = CAPSIZE_FUNCTIONS.some((fnName) =>
    isLibraryReference(callee, fnName, CAPSIZE_PACKAGES, {
      allowDefaultImport: fnName === 'capsize',
      allowGlobal: false,
    }),
  );
  if (
    !isImportedFromPkg &&
    (!Node.isObjectLiteralExpression(firstArg) || !hasCapsizeMetricsConfig(firstArg))
  ) {
    return null;
  }

  return `${matchedFn}() leading-trim compensation can be modernized with native CSS text-box-trim and text-box-edge (text-box: trim-both cap alphabetic).`;
}

export const preciseTextAlignmentPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    CAPSIZE_DEPENDENCY_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy font leading-trim package "${pkgName}" (${versionRange}) can be modernized with native CSS text-box-trim and text-box-edge (text-box: trim-both cap alphabetic).`,
  );

export const preciseTextAlignmentJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['createStyleObject', 'createStyleString', 'capsize'],
  featureGuardTokens: TEXT_BOX_GUARD_TOKENS,
  matchCall: (node) => matchCapsizeCall(node),
});

export const preciseTextAlignmentCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['leading-trim', 'text-edge'],
  matchRule: (styleRule: CssRuleView, _ctx: CssMatcherContext) => {
    if (
      styleRule.hasProperty('text-box') ||
      styleRule.hasProperty('text-box-trim')
    ) {
      return null;
    }

    if (
      styleRule.hasProperty('leading-trim') ||
      styleRule.hasProperty('text-edge')
    ) {
      return {
        message:
          'CSS rule uses legacy draft leading-trim / text-edge properties; modernize with standard CSS text-box-trim and text-box-edge (or text-box: trim-both cap alphabetic).',
      };
    }

    return null;
  },
};

export const preciseTextAlignmentPackageRule: AnalyzerRule = {
  id: 'precise-text-alignment/package-capsize',
  guideId: 'precise-text-alignment',
  guideHash: PRECISE_TEXT_ALIGNMENT_GUIDE_HASH,
  summary:
    'Capsize leading-trim package (capsize) should be modernized with CSS text-box-trim and text-box-edge.',
  matcher: preciseTextAlignmentPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares capsize in package.json dependencies to trim font leading above cap-height and below the alphabetic baseline.',
    ],
    dropWhen: [
      'The project already uses native CSS text-box, text-box-trim, and text-box-edge.',
      'The code only sets standard vertical-align: middle or line-height: 1.5 body text leading.',
    ],
  },
};

export const preciseTextAlignmentJsRule: AnalyzerRule = {
  id: 'precise-text-alignment/js-capsize',
  guideId: 'precise-text-alignment',
  guideHash: PRECISE_TEXT_ALIGNMENT_GUIDE_HASH,
  summary:
    'Capsize createStyleObject / capsize() calls generating negative-margin leading-trim workarounds should be modernized with CSS text-box-trim and text-box-edge.',
  matcher: preciseTextAlignmentJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls createStyleObject(), createStyleString(), or capsize() with fontMetrics / capHeight to generate negative-margin leading-trim CSS styles.',
    ],
    dropWhen: [
      'The call is guarded by a CSS.supports("text-box-trim", "trim-both") fallback check or the file already defines CSS text-box-trim / leading-trim / --cap-height-scale styles.',
      'React Native files (.native.js/.ts/.tsx) or raw numeric precomputeValues() helpers that do not generate CSS ::before/::after leading-trim styles.',
      'The code uses standard vertical-align: middle or standard line-height body text leading.',
    ],
  },
};

export const preciseTextAlignmentCssRule: AnalyzerRule = {
  id: 'precise-text-alignment/css-leading-trim',
  guideId: 'precise-text-alignment',
  guideHash: PRECISE_TEXT_ALIGNMENT_GUIDE_HASH,
  summary:
    'Legacy draft CSS leading-trim and text-edge declarations should be modernized with standard CSS text-box-trim and text-box-edge.',
  matcher: preciseTextAlignmentCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule declares legacy draft leading-trim or text-edge without standard text-box or text-box-trim.',
    ],
    dropWhen: [
      'The CSS rule already declares standard text-box or text-box-trim and text-box-edge.',
      'The rule only uses standard vertical-align: middle or line-height declarations.',
    ],
  },
};

export default [
  preciseTextAlignmentPackageRule,
  preciseTextAlignmentJsRule,
  preciseTextAlignmentCssRule,
] satisfies readonly AnalyzerRule[];
