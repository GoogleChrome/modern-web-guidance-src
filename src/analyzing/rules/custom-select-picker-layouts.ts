import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
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

export const CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH = '806663852c25';

const CUSTOM_SELECT_PACKAGES = [
  'choices.js',
  'tom-select',
  'select2',
  'slim-select',
] as const;

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

function matchesPackageSpec(
  spec: string | null,
  packages: readonly string[],
): boolean {
  return (
    spec !== null &&
    packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))
  );
}

function isRequireOfPackage(
  node: Node,
  packages: readonly string[],
): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped)) {
    return false;
  }
  const callee = unwrapExpression(unwrapped.getExpression());
  const firstArg = unwrapped.getArguments()[0];
  if (
    Node.isIdentifier(callee) &&
    callee.getText() === 'require' &&
    firstArg &&
    Node.isStringLiteral(firstArg)
  ) {
    return matchesPackageSpec(firstArg.getLiteralText(), packages);
  }
  return false;
}

function checkEnclosingBindings(
  identNode: Node,
  localName: string,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean,
): 'matched' | 'shadowed' | 'none' {
  let current: Node | undefined = identNode.getParent();
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      if (
        (Node.isFunctionDeclaration(current) || Node.isFunctionExpression(current)) &&
        current.getName() === localName
      ) {
        return 'shadowed';
      }
      for (const param of current.getParameters()) {
        const paramNameNode = param.getNameNode();
        if (Node.isIdentifier(paramNameNode) && paramNameNode.getText() === localName) {
          return 'shadowed';
        }
        for (const el of paramNameNode.getDescendantsOfKind(SyntaxKind.Identifier)) {
          if (el.getText() === localName) {
            return 'shadowed';
          }
        }
      }
    }

    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      for (const stmt of current.getStatements()) {
        if (
          (Node.isFunctionDeclaration(stmt) || Node.isClassDeclaration(stmt)) &&
          stmt.getName() === localName
        ) {
          return 'shadowed';
        }
        if (!Node.isVariableStatement(stmt)) {
          continue;
        }
        for (const decl of stmt.getDeclarationList().getDeclarations()) {
          const nameNode = decl.getNameNode();
          if (Node.isIdentifier(nameNode) && nameNode.getText() === localName) {
            const init = decl.getInitializer();
            if (init) {
              const resolvedInit = resolveLocalExpression(init, 2);
              if (
                allowDefaultImport &&
                isRequireOfPackage(resolvedInit, packages)
              ) {
                return 'matched';
              }
              if (Node.isPropertyAccessExpression(resolvedInit)) {
                const propName = resolvedInit.getName();
                if (
                  (propName === identName ||
                    (allowDefaultImport && propName === 'default')) &&
                  isRequireOfPackage(
                    resolveLocalExpression(resolvedInit.getExpression(), 2),
                    packages,
                  )
                ) {
                  return 'matched';
                }
              }
            }
            return 'shadowed';
          } else if (Node.isObjectBindingPattern(nameNode)) {
            for (const el of nameNode.getElements()) {
              if (el.getName() === localName) {
                const propName = el.getPropertyNameNode()?.getText() ?? el.getName();
                const init = decl.getInitializer();
                if (
                  init &&
                  (propName === identName || (allowDefaultImport && propName === 'default')) &&
                  isRequireOfPackage(resolveLocalExpression(init, 2), packages)
                ) {
                  return 'matched';
                }
                return 'shadowed';
              }
            }
          } else if (Node.isArrayBindingPattern(nameNode)) {
            for (const el of nameNode.getElements()) {
              if (Node.isBindingElement(el) && el.getName() === localName) {
                return 'shadowed';
              }
            }
          }
        }
      }
    }

    current = current.getParent();
  }
  return 'none';
}

function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean = true,
  allowGlobal: boolean = true,
): boolean {
  const unwrapped = unwrapExpression(node);

  if (allowDefaultImport && isRequireOfPackage(unwrapped, packages)) {
    return true;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    const propName = unwrapped.getName();
    if (propName === identName || (allowDefaultImport && propName === 'default')) {
      const receiver = unwrapped.getExpression();
      if (isRequireOfPackage(resolveLocalExpression(receiver, 2), packages)) {
        return true;
      }
    }
  }

  if (Node.isIdentifier(unwrapped)) {
    const localName = unwrapped.getText();
    const sourceFile = unwrapped.getSourceFile();

    const bindingStatus = checkEnclosingBindings(
      unwrapped,
      localName,
      identName,
      packages,
      allowDefaultImport,
    );
    if (bindingStatus === 'matched') {
      return true;
    }
    if (bindingStatus === 'shadowed') {
      return false;
    }

    for (const imp of sourceFile.getImportDeclarations()) {
      const matchesPkg = matchesPackageSpec(getSafeModuleSpecifier(imp), packages);
      if (
        imp.getDefaultImport()?.getText() === localName ||
        imp.getNamespaceImport()?.getText() === localName
      ) {
        return allowDefaultImport && matchesPkg;
      }
      for (const named of imp.getNamedImports()) {
        const importedName = named.getName();
        const boundName = named.getAliasNode()?.getText() ?? importedName;
        if (boundName === localName) {
          return (
            matchesPkg &&
            (importedName === identName ||
              (allowDefaultImport && importedName === 'default'))
          );
        }
      }
    }
  }

  if (allowGlobal && isGlobalReference(unwrapped, identName)) {
    return true;
  }

  return false;
}

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

  if (configObj.getProperty('ajax') || configObj.getProperty('load')) {
    return true;
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
      /\bmultiple\b/i.test(targetArg.getText()) ||
      /\bmultiple\b/i.test(resolvedTarget.getText())
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

export const customSelectPickerLayoutsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: CUSTOM_SELECT_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Custom select layout dependency "${pkgName}" (${versionRange}) can be modernized with CSS appearance: base-select, ::picker(select), and <selectedcontent>.`,
    };
  },
};

export const customSelectPickerLayoutsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'Choices',
    'TomSelect',
    'SlimSelect',
    'select2',
    'callbackOnCreateTemplates',
    'templateResult',
    'templateSelection',
  ],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isNewExpression(node) && !Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByCustomizableSelect(node)) {
        return;
      }

      const message = Node.isNewExpression(node)
        ? matchNewCustomSelect(node)
        : matchSelect2Call(node);

      if (message) {
        const line = node.getStartLineNumber();
        if (!visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({
            line,
            message,
          });
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
    'Custom select dropdown libraries (choices.js, tom-select, select2, slim-select) used for rich option layouts can be modernized with CSS appearance: base-select and ::picker(select).',
  matcher: customSelectPickerLayoutsPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares choices.js, tom-select, select2, or slim-select in package.json dependencies to build custom single-select option layouts.',
    ],
    dropWhen: [
      'Multi-select tag/token inputs with chip removal.',
      'Asynchronous remote typeahead search comboboxes or hierarchical treeview comboboxes.',
    ],
  },
};

export const customSelectPickerLayoutsJsRule: AnalyzerRule = {
  id: 'custom-select-picker-layouts/js-custom-select',
  guideId: 'custom-select-picker-layouts',
  guideHash: CUSTOM_SELECT_PICKER_LAYOUTS_GUIDE_HASH,
  summary:
    'JavaScript new Choices(), new TomSelect(), new SlimSelect(), and $(...).select2() calls configuring custom single-select option templates should be modernized with CSS appearance: base-select.',
  matcher: customSelectPickerLayoutsJsMatcher,
  phase2Rubric: {
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

export const customSelectPickerLayoutsRules: readonly AnalyzerRule[] = [
  customSelectPickerLayoutsJsRule,
];
