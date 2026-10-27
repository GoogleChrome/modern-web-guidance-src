import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type ObjectLiteralExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH = '806663852c25';

const CUSTOM_SELECT_GUARD_TOKENS = [
  'base-select',
  'appearance: base-select',
  '::picker(select)',
  'picker(select)',
  'selectedcontent',
] as const;

const TEMPLATE_OPTION_KEYS = [
  'callbackOnCreateTemplates',
  'templateResult',
  'templateSelection',
] as const;

function isGuardedByCustomizableSelect(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, CUSTOM_SELECT_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        CUSTOM_SELECT_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
        current.getExpression().getDescendantsOfKind(SyntaxKind.ExclamationToken).length > 0 &&
        node.getStart() >= current.getThenStatement().getStart() &&
        node.getEnd() <= current.getThenStatement().getEnd()
      ) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function isMultiOrAsyncConfig(configObj: ObjectLiteralExpression): boolean {
  for (const key of ['multiple', 'tags', 'create', 'removeItemButton'] as const) {
    const prop = configObj.getProperty(key);
    if (!prop) {
      continue;
    }
    if (Node.isShorthandPropertyAssignment(prop) || Node.isMethodDeclaration(prop)) {
      return true;
    }
    if (Node.isPropertyAssignment(prop)) {
      const init = prop.getInitializer();
      if (init && unwrapExpression(init).getKind() !== SyntaxKind.FalseKeyword) {
        return true;
      }
    }
  }

  const modeProp = configObj.getProperty('mode');
  if (modeProp && Node.isPropertyAssignment(modeProp)) {
    const init = modeProp.getInitializer();
    if (init && /\bmulti\b/i.test(init.getText())) {
      return true;
    }
  }

  const selectProp = configObj.getProperty('select');
  if (selectProp && Node.isPropertyAssignment(selectProp)) {
    const init = selectProp.getInitializer();
    if (init && /\bmultiple\b/i.test(init.getText())) {
      return true;
    }
  }

  if (
    configObj.getProperty('ajax') ||
    configObj.getProperty('load') ||
    configObj.getProperty('matcher') ||
    configObj.getProperty('query') ||
    configObj.getProperty('tokenizer') ||
    configObj.getProperty('tokenSeparators') ||
    configObj.getProperty('minimumInputLength') ||
    configObj.getProperty('maximumInputLength') ||
    configObj.getProperty('maximumSelectionLength') ||
    configObj.getProperty('allowClear') ||
    configObj.getProperty('plugins') ||
    configObj.getProperty('searchField') ||
    configObj.getProperty('searchFields') ||
    configObj.getProperty('fuseOptions') ||
    configObj.getProperty('addable')
  ) {
    return true;
  }

  for (const searchKey of ['searchEnabled', 'searchChoices', 'showSearch'] as const) {
    const searchProp = configObj.getProperty(searchKey);
    if (searchProp && Node.isPropertyAssignment(searchProp)) {
      const init = searchProp.getInitializer();
      if (init && unwrapExpression(init).getKind() === SyntaxKind.TrueKeyword) {
        return true;
      }
    }
  }

  const closeProp = configObj.getProperty('closeOnSelect');
  if (closeProp && Node.isPropertyAssignment(closeProp)) {
    const init = closeProp.getInitializer();
    if (init && unwrapExpression(init).getKind() === SyntaxKind.FalseKeyword) {
      return true;
    }
  }

  const minSearchProp = configObj.getProperty('minimumResultsForSearch');
  if (minSearchProp && Node.isPropertyAssignment(minSearchProp)) {
    const init = minSearchProp.getInitializer();
    if (init) {
      const unwrapped = unwrapExpression(init);
      if (
        Node.isNumericLiteral(unwrapped) &&
        Number(unwrapped.getLiteralText()) >= 0
      ) {
        return true;
      }
    }
  }

  for (const maxKey of ['maxItems', 'maxItemCount'] as const) {
    const maxProp = configObj.getProperty(maxKey);
    if (maxProp && Node.isPropertyAssignment(maxProp)) {
      const init = maxProp.getInitializer();
      if (init) {
        const unwrapped = unwrapExpression(init);
        if (
          !Node.isNumericLiteral(unwrapped) ||
          Number(unwrapped.getLiteralText()) !== 1
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function hasCustomOptionTemplate(configObj: ObjectLiteralExpression): boolean {
  for (const key of TEMPLATE_OPTION_KEYS) {
    if (configObj.getProperty(key)) {
      return true;
    }
  }

  const renderProp = configObj.getProperty('render');
  if (renderProp) {
    if (Node.isMethodDeclaration(renderProp)) {
      return true;
    }
    if (Node.isPropertyAssignment(renderProp)) {
      const init = renderProp.getInitializer();
      if (init) {
        const resolved = resolveLocalExpression(init, 2);
        if (Node.isObjectLiteralExpression(resolved)) {
          if (resolved.getProperty('option') || resolved.getProperty('item')) {
            return true;
          }
        }
      }
    }
  }

  const dataProp = configObj.getProperty('data');
  if (dataProp && Node.isPropertyAssignment(dataProp)) {
    const init = dataProp.getInitializer();
    if (init && /\bhtml\s*:/.test(init.getText())) {
      return true;
    }
  }

  return false;
}

function isValidCustomTemplateConfig(
  configArg: Node | undefined,
  targetArg: Node | undefined,
): boolean {
  if (!configArg) {
    return false;
  }
  if (targetArg) {
    const resolvedTarget = resolveLocalExpression(targetArg, 2);
    if (
      /\b(?:multiple|input)\b/i.test(targetArg.getText()) ||
      /\b(?:multiple|input)\b/i.test(resolvedTarget.getText())
    ) {
      return false;
    }
  }
  const resolved = resolveLocalExpression(configArg, 2);
  if (!Node.isObjectLiteralExpression(resolved)) {
    return false;
  }
  if (isMultiOrAsyncConfig(resolved)) {
    return false;
  }
  return hasCustomOptionTemplate(resolved);
}

function matchNewCustomSelect(newExpr: NewExpression): string | null {
  const args = newExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const callee = unwrapExpression(newExpr.getExpression());

  if (isLibraryReference(callee, 'Choices', ['choices.js'])) {
    if (isValidCustomTemplateConfig(args[1], args[0])) {
      return 'new Choices() custom option template layout can be modernized with CSS appearance: base-select, ::picker(select), and <selectedcontent>.';
    }
  }

  if (isLibraryReference(callee, 'TomSelect', ['tom-select'])) {
    if (isValidCustomTemplateConfig(args[1], args[0])) {
      return 'new TomSelect() custom option render layout can be modernized with CSS appearance: base-select, ::picker(select), and <selectedcontent>.';
    }
  }

  if (isLibraryReference(callee, 'SlimSelect', ['slim-select'])) {
    const configArg = args.length >= 2 ? args[1] : args[0];
    const targetArg = args.length >= 2 ? args[0] : undefined;
    if (isValidCustomTemplateConfig(configArg, targetArg)) {
      return 'new SlimSelect() custom option template layout can be modernized with CSS appearance: base-select, ::picker(select), and <selectedcontent>.';
    }
  }

  return null;
}

function matchSelect2Call(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'select2') {
    return null;
  }

  if (isValidCustomTemplateConfig(args[0], callee.getExpression())) {
    return '$(...).select2() with templateResult / templateSelection can be modernized with CSS appearance: base-select, ::picker(select), and <selectedcontent>.';
  }

  return null;
}

export const customSelectPickerLayoutsJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    'Choices',
    'TomSelect',
    'SlimSelect',
    'select2',
    'callbackOnCreateTemplates',
    'templateResult',
    'templateSelection',
  ],
  dedupeLines: true,
  isGuarded: (node) => isGuardedByCustomizableSelect(node),
  matchCall: (node) => matchSelect2Call(node),
  matchNew: (node) => matchNewCustomSelect(node),
});

export const customSelectPickerLayoutsJsRule: AnalyzerRule = {
  id: 'custom-select-picker-layouts/js-custom-select',
  guideId: 'custom-select-picker-layouts',
  guideHash: CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH,
  summary:
    'JavaScript new Choices(), new TomSelect(), new SlimSelect(), and $(...).select2() calls configuring custom single-select option templates should be modernized with CSS appearance: base-select.',
  matcher: customSelectPickerLayoutsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript initializes new Choices(), new TomSelect(), new SlimSelect(), or $(...).select2() with custom option templates (callbackOnCreateTemplates, render.option, templateResult, templateSelection) on a single-select element.',
      'Custom div-based select option menus render rich option cards or grid layouts mirroring a single-select value.',
    ],
    dropWhen: [
      'The select configuration enables multi-select tagging (multiple: true, tags: true, maxItems > 1) or remote asynchronous search (ajax).',
      'The call is guarded by CSS.supports("appearance", "base-select").',
    ],
  },
};

export default [
  customSelectPickerLayoutsJsRule,
] satisfies readonly AnalyzerRule[];
