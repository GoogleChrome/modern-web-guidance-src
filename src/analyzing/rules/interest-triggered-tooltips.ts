import {
  Node,
  SyntaxKind,
  type CallExpression,
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
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH = '332c95d0cbc9';

const INTEREST_GUARD_TOKENS = [
  'interestfor',
  'interesttarget',
  'popover',
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
        for (const el of param.getDescendantsOfKind(identNode.getKind())) {
          if (el.getText() === localName && el.getParent() !== current) {
            return 'shadowed';
          }
        }
      }
    }

    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      for (const stmt of current.getStatements()) {
        if (!Node.isVariableStatement(stmt)) {
          continue;
        }
        for (const decl of stmt.getDeclarationList().getDeclarations()) {
          const nameNode = decl.getNameNode();
          if (Node.isObjectBindingPattern(nameNode)) {
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

    const resolved = resolveLocalExpression(unwrapped, 2);
    if (resolved !== unwrapped) {
      if (allowDefaultImport && isRequireOfPackage(resolved, packages)) {
        return true;
      }
      if (Node.isPropertyAccessExpression(resolved)) {
        const propName = resolved.getName();
        if (
          (propName === identName || (allowDefaultImport && propName === 'default')) &&
          isRequireOfPackage(resolveLocalExpression(resolved.getExpression(), 2), packages)
        ) {
          return true;
        }
      }
      return false;
    }
  }

  if (allowGlobal && isGlobalReference(unwrapped, identName)) {
    return true;
  }

  return false;
}

const NON_SIMPLE_TIPPY_OPTION_KEYS: ReadonlySet<string> = new Set([
  'followCursor',
  'allowHTML',
  'onShow',
  'onShown',
  'onTrigger',
  'onUntrigger',
  'onCreate',
  'onMount',
  'onHide',
  'onHidden',
  'onClickOutside',
  'popperOptions',
  'plugins',
  'sticky',
  'inlinePositioning',
  'appendTo',
  'render',
]);

function isInteractiveOrClickPopoverConfig(optionsObj: ObjectLiteralExpression): boolean {
  for (const prop of optionsObj.getProperties()) {
    if (
      Node.isPropertyAssignment(prop) ||
      Node.isShorthandPropertyAssignment(prop) ||
      Node.isMethodDeclaration(prop)
    ) {
      const name = prop.getName();
      if (NON_SIMPLE_TIPPY_OPTION_KEYS.has(name)) {
        if (Node.isPropertyAssignment(prop)) {
          const init = prop.getInitializer();
          if (init && unwrapExpression(init).getKind() === SyntaxKind.FalseKeyword) {
            continue;
          }
        }
        return true;
      }
      if (name === 'interactive') {
        if (Node.isShorthandPropertyAssignment(prop)) {
          return true;
        }
        if (Node.isPropertyAssignment(prop)) {
          const init = prop.getInitializer();
          if (init && unwrapExpression(init).getKind() !== SyntaxKind.FalseKeyword) {
            return true;
          }
        }
      }
      if (name === 'content') {
        if (Node.isMethodDeclaration(prop)) {
          return true;
        }
        if (Node.isPropertyAssignment(prop)) {
          const init = prop.getInitializer();
          if (init) {
            const resolvedContent = resolveLocalExpression(init, 2);
            if (
              Node.isArrowFunction(resolvedContent) ||
              Node.isFunctionExpression(resolvedContent)
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  const triggerProp = optionsObj.getProperty('trigger');
  if (triggerProp && Node.isPropertyAssignment(triggerProp)) {
    const init = triggerProp.getInitializer();
    if (init) {
      const unwrapped = unwrapExpression(init);
      if (Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)) {
        const triggerText = unwrapped.getLiteralText();
        if (triggerText.includes('click') || triggerText.includes('manual')) {
          return true;
        }
      }
    }
  }

  return false;
}

function matchTippyCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length === 0 || !args[0]) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!isLibraryReference(callee, 'tippy', ['tippy.js', '@tippyjs/react'])) {
    return null;
  }

  const targetNode = resolveLocalExpression(args[0], 2);
  if (Node.isObjectLiteralExpression(targetNode)) {
    return null;
  }

  if (args[1]) {
    const optionsNode = resolveLocalExpression(args[1], 2);
    if (
      Node.isObjectLiteralExpression(optionsNode) &&
      isInteractiveOrClickPopoverConfig(optionsNode)
    ) {
      return null;
    }
  }

  return 'tippy() hover tooltip initialization can be modernized with declarative HTML interestfor / interesttarget, popover="hint", and CSS Anchor Positioning.';
}

function isGuardedByInterestCheck(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, INTEREST_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        INTEREST_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

export const interestTriggeredTooltipsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['tippy'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByInterestCheck(node)) {
        return;
      }

      const msg = matchTippyCall(node);
      if (msg) {
        matches.push({
          line: node.getStartLineNumber(),
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const interestTriggeredTooltipsJsRule: AnalyzerRule = {
  id: 'interest-triggered-tooltips/js-tooltip',
  guideId: 'interest-triggered-tooltips',
  guideHash: INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH,
  summary:
    'JavaScript tippy() hover tooltip calls should be modernized with declarative HTML interestfor, popover="hint", and CSS Anchor Positioning.',
  matcher: interestTriggeredTooltipsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls tippy(target, options) to attach hover/focus tooltips without interactive click menus.',
      'Custom mouseenter hover delay timeouts position tooltip div elements.',
    ],
    dropWhen: [
      'The tippy() instance configures interactive: true or trigger: "click" for interactive menus or forms.',
      'The code uses native HTML title attributes, static pure-CSS [data-tooltip]::after tooltips, or is guarded by an interestfor / interesttarget check.',
    ],
  },
};

export const interestTriggeredTooltipsRules: readonly AnalyzerRule[] = [
  interestTriggeredTooltipsJsRule,
];
