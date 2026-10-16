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

export const CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH = '806663852c25';

const CUSTOM_SELECT_PACKAGES = [
  'choices.js',
  'tom-select',
  'downshift',
  'react-select',
] as const;

const SELECT_PICKER_FEATURE_TOKENS = [
  'base-select',
  'appearance: base-select',
  '::picker(select)',
  'picker(select)',
] as const;

export const customSelectDependencyMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: CUSTOM_SELECT_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message:
        `Custom select and picker library "${pkgName}" (${versionRange}) can be replaced with native customizable <select> (appearance: base-select and ::picker(select)).`,
    };
  },
};

/**
 * Checks whether an expression is TomSelect or Choices constructor/factory.
 */
function isCustomSelectConstructor(expr: Node): string | null {
  const unwrapped = unwrapExpression(expr);
  if (Node.isIdentifier(unwrapped)) {
    const name = unwrapped.getText();
    if (name === 'TomSelect' || name === 'Choices') {
      return name;
    }
  }
  if (Node.isPropertyAccessExpression(unwrapped)) {
    const propName = unwrapped.getName();
    if (propName === 'TomSelect' || propName === 'Choices') {
      return propName;
    }
  }
  return null;
}

export const customSelectJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['TomSelect', 'Choices'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    const recordMatch = (node: Node, message: string): void => {
      const line = node.getStartLineNumber();
      if (visitedLines.has(line)) {
        return;
      }
      visitedLines.add(line);
      matches.push({ line, message });
    };

    sourceFile.forEachDescendant((node) => {
      if (isProtectedByFeatureGuard(node, SELECT_PICKER_FEATURE_TOKENS)) {
        return;
      }

      if (Node.isNewExpression(node)) {
        const ctor = node.getExpression();
        const ctorName = isCustomSelectConstructor(ctor);
        if (ctorName !== null) {
          recordMatch(
            node,
            `Instantiating custom select control via new ${ctorName}(...) can be replaced with native customizable <select> (appearance: base-select).`,
          );
          return;
        }
      }

      if (Node.isCallExpression(node)) {
        const callee = node.getExpression();
        const calleeName = isCustomSelectConstructor(callee);
        if (calleeName !== null) {
          recordMatch(
            node,
            `Call to ${calleeName}(...) can be replaced with native customizable <select> (appearance: base-select).`,
          );
        }
      }
    });

    return matches;
  },
};

export const customSelectPickerLayoutsPackageRule: AnalyzerRule = {
  id: 'custom-select-picker-layouts/package-custom-select',
  guideId: 'custom-select-picker-layouts',
  guideHash: CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH,
  summary:
    'Custom select and picker libraries (choices.js, tom-select, downshift, react-select) can be modernized using native customizable <select> with appearance: base-select.',
  matcher: customSelectDependencyMatcher,
  phase2Rubric: {
    keepWhen: [
      'Using custom select and picker libraries (choices.js, tom-select, downshift, react-select) to create custom option layouts or rich picker interfaces.',
      'Instantiating custom select controls via new TomSelect(...) or new Choices(...) to replace browser select picker appearance.',
    ],
    dropWhen: [
      'Code already using CSS appearance: base-select with ::picker(select) to lay out select options in grid or custom layouts.',
      'Complex comboboxes requiring remote server-side typeahead, debounced querying, and asynchronous pagination that require full custom combobox architectures.',
      'Instances where Choices or TomSelect is used strictly for multi-item token input or tagging on text inputs rather than styling select dropdown pickers.',
    ],
  },
};

export const customSelectPickerLayoutsJsRule: AnalyzerRule = {
  id: 'custom-select-picker-layouts/js-custom-select',
  guideId: 'custom-select-picker-layouts',
  guideHash: CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH,
  summary:
    'Imperative custom select initializations (new TomSelect(...), new Choices(...)) can be modernized with native customizable <select>.',
  matcher: customSelectJsMatcher,
  phase2Rubric: customSelectPickerLayoutsPackageRule.phase2Rubric,
};

export const customSelectPickerLayoutsRules: readonly AnalyzerRule[] = [
  customSelectPickerLayoutsPackageRule,
  customSelectPickerLayoutsJsRule,
];
