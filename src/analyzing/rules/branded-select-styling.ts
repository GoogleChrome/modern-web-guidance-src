import {
  Node,
  type CallExpression,
} from 'ts-morph';
import { unwrapExpression } from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
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
  'selectric',
]);

const SEARCH_OR_COMPLEX_OPTIONS_REGEX =
  /\b(?:multiple\s*:\s*true|ajax\s*:|tags\s*:|query\s*:|matcher\s*:|minimumInputLength\s*:|liveSearch\s*:|search_contains\s*:)/i;

function isJQueryIdentifierName(name: string): boolean {
  return name.startsWith('$') || name === 'jQuery' || name === 'mQuery';
}

function isJQueryLikeReceiver(node: Node): boolean {
  let current: Node = unwrapExpression(node);
  while (true) {
    if (Node.isIdentifier(current)) {
      return isJQueryIdentifierName(current.getText());
    }
    if (Node.isPropertyAccessExpression(current)) {
      if (isJQueryIdentifierName(current.getName())) {
        return true;
      }
      current = unwrapExpression(current.getExpression());
      continue;
    }
    if (Node.isCallExpression(current) || Node.isElementAccessExpression(current)) {
      current = unwrapExpression(current.getExpression());
      continue;
    }
    return false;
  }
}

const brandedSelectStylingDependencyMatcher: DependencyRuleMatcher = createDependencyMatcher(
  TARGET_SELECT_PACKAGES,
  (pkgName, versionRange) =>
    `Legacy custom select library "${pkgName}" (${versionRange}) can be modernized using native customizable <select> with appearance: base-select and ::picker(select).`,
);

function matchSelectCall(node: CallExpression): string | null {
  const expr = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName().toLowerCase();
  if (!TARGET_JS_METHODS.has(methodName)) {
    return null;
  }

  // Check receiver: for chosen, require jQuery-like receiver (reject this.chosen())
  if (methodName === 'chosen' && !isJQueryLikeReceiver(expr.getExpression())) {
    return null;
  }

  // Exclude multi-select, remote ajax search, or tag-creation options in AST
  const args = node.getArguments();
  if (args.length > 0) {
    const argText = args[0]?.getText() ?? '';
    if (SEARCH_OR_COMPLEX_OPTIONS_REGEX.test(argText)) {
      return null;
    }
  }

  return `Legacy custom select method call .${expr.getName()}() replaces native <select>; modernize with customizable select (appearance: base-select and ::picker(select)).`;
}

const brandedSelectStylingJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['select2', 'chosen', 'selectpicker', 'niceSelect', 'niceselect', 'selectric'],
  dedupeLines: true,
  featureGuardTokens: SELECT_FEATURE_TOKENS,
  matchCall: matchSelectCall,
});

export const brandedSelectStylingRule: AnalyzerRule = {
  id: 'branded-select-styling',
  guideId: 'branded-select-styling',
  guideHash: BRANDED_SELECT_STYLING_GUIDE_HASH,
  summary:
    'Legacy select styling libraries (select2, chosen-js, bootstrap-select, nice-select) can be modernized using native customizable <select> with appearance: base-select.',
  matcher: brandedSelectStylingDependencyMatcher,
  verifierRubric: {
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
  verifierRubric: brandedSelectStylingRule.verifierRubric,
};

export default [
  brandedSelectStylingRule,
  brandedSelectStylingJsRule,
] satisfies readonly AnalyzerRule[];
