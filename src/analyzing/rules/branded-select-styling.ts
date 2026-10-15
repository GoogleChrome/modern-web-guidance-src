import {
  Node,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
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

export const BRANDED_SELECT_STYLING_GUIDE_HASH = 'c332c3c67d49';

const TARGET_SELECT_PACKAGES = [
  'select2',
  'chosen-js',
  'bootstrap-select',
  'nice-select',
] as const;

const SELECT_FEATURE_TOKENS = [
  'base-select',
  'appearance: base-select',
  '::picker(select)',
  'picker(select)',
] as const;

const TARGET_JS_METHODS: ReadonlySet<string> = new Set([
  'select2',
  'chosen',
  'selectpicker',
  'niceselect',
]);

const brandedSelectStylingDependencyMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: TARGET_SELECT_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message:
        `Legacy custom select library "${pkgName}" (${versionRange}) can be modernized using native customizable <select> with appearance: base-select and ::picker(select).`,
    };
  },
};

const brandedSelectStylingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['select2', 'chosen', 'selectpicker', 'niceSelect', 'niceselect'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const expr = unwrapExpression(node.getExpression());
      if (!Node.isPropertyAccessExpression(expr)) {
        return;
      }

      const methodName = expr.getName().toLowerCase();
      if (!TARGET_JS_METHODS.has(methodName)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, SELECT_FEATURE_TOKENS)) {
        return;
      }

      const line = node.getStartLineNumber();
      if (visitedLines.has(line)) {
        return;
      }

      visitedLines.add(line);
      matches.push({
        line,
        message:
          `Legacy custom select method call .${expr.getName()}() replaces native <select>; modernize with customizable select (appearance: base-select and ::picker(select)).`,
      });
    });

    return matches;
  },
};

export const brandedSelectStylingRule: AnalyzerRule = {
  id: 'branded-select-styling',
  guideId: 'branded-select-styling',
  guideHash: BRANDED_SELECT_STYLING_GUIDE_HASH,
  summary:
    'Legacy select styling libraries (select2, chosen-js, bootstrap-select, nice-select) can be modernized using native customizable <select> with appearance: base-select.',
  matcher: brandedSelectStylingDependencyMatcher,
  phase2Rubric: {
    keepWhen: [
      'Project dependencies (package.json) include select2, chosen-js, bootstrap-select, or nice-select to style and brand dropdown select menus.',
      'JavaScript invokes $(...).select2(), $(...).chosen(), $(...).selectpicker(), or $(...).niceSelect() on select elements to replace default browser select styling with custom UI menus.',
    ],
    dropWhen: [
      'The select widget requires asynchronous server-side remote search autocomplete, infinite scrolling, or multi-select tagging combobox features not yet covered by customizable select.',
      'The invocation is guarded by a feature query or runtime check for appearance: base-select.',
      'The method call belongs to an unrelated API sharing the same method name (not targeting select controls).',
    ],
  },
};

export const brandedSelectStylingJsRule: AnalyzerRule = {
  id: 'branded-select-styling/js',
  guideId: 'branded-select-styling',
  guideHash: BRANDED_SELECT_STYLING_GUIDE_HASH,
  summary:
    'Imperative custom select initializations (.select2(), .chosen(), .selectpicker(), .niceSelect()) should be replaced with native customizable <select>.',
  matcher: brandedSelectStylingJsMatcher,
  phase2Rubric: brandedSelectStylingRule.phase2Rubric,
};

export const brandedSelectStylingDependencyRule = brandedSelectStylingRule;

export const brandedSelectStylingRules: readonly AnalyzerRule[] = [
  brandedSelectStylingRule,
  brandedSelectStylingJsRule,
];
