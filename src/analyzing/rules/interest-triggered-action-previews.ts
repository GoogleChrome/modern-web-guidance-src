import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
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

export const INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH = 'c3ad39a2b24e';

const HOVERINTENT_PACKAGES = [
  'hoverintent',
  'jquery-hoverintent',
] as const;

const INTEREST_PREVIEW_GUARD_TOKENS = [
  'interestForElement',
  'interestfor',
  'interesttarget',
  'InterestEvent',
  'loseinterest',
] as const;

const HOVER_EVENTS = [
  'mouseenter',
  'mouseover',
  'focusin',
] as const;

const PREVIEW_ACTION_REGEX =
  /\b(?:preview|hovercard|hoverCard|actionCard|quickview|quickView|popover|showPopover|togglePopover)\b|dataset\.preview|dataset\.effect/i;

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

function isGuardedByInterestInvoker(node: Node, fileContent: string): boolean {
  if (
    /\binterestfor\s*=/i.test(fileContent) ||
    /\binteresttarget\s*=/i.test(fileContent)
  ) {
    return true;
  }
  if (isProtectedByFeatureGuard(node, INTEREST_PREVIEW_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        INTEREST_PREVIEW_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function hasSetTimeoutWithPreviewContext(handlerNode: Node): boolean {
  const calls = handlerNode.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const callExpr of calls) {
    const callee = unwrapExpression(callExpr.getExpression());
    const isSetTimeout =
      isGlobalReference(callee, 'setTimeout') ||
      (Node.isPropertyAccessExpression(callee) &&
        callee.getName() === 'setTimeout' &&
        isGlobalReference(callee.getExpression(), 'window'));
    if (!isSetTimeout) {
      continue;
    }
    const callbackArg = callExpr.getArguments()[0];
    if (!callbackArg) {
      continue;
    }
    const resolvedCallback = resolveCallableNode(callbackArg, 2);
    if (
      PREVIEW_ACTION_REGEX.test(resolvedCallback.getText()) ||
      PREVIEW_ACTION_REGEX.test(handlerNode.getText())
    ) {
      return true;
    }
  }
  return false;
}

function matchHoverPreviewCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  const callee = unwrapExpression(callExpr.getExpression());

  if (
    args.length >= 2 &&
    (isLibraryReference(callee, 'hoverintent', HOVERINTENT_PACKAGES) ||
      isLibraryReference(callee, 'hoverIntent', HOVERINTENT_PACKAGES))
  ) {
    return 'hoverintent() hover-intent listener can be modernized with declarative HTML interestfor and interest / loseinterest events.';
  }

  if (
    args.length >= 1 &&
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === 'hoverIntent'
  ) {
    return 'jQuery .hoverIntent() listener can be modernized with declarative HTML interestfor and interest / loseinterest events.';
  }

  const matchedListener = matchEventListenerCall(callExpr, HOVER_EVENTS);
  if (matchedListener && hasSetTimeoutWithPreviewContext(matchedListener.handlerNode)) {
    return `Manual ${matchedListener.eventName} + setTimeout hover-intent preview delay can be modernized with declarative HTML interestfor, interest-delay, and interest / loseinterest events.`;
  }

  return null;
}

export const interestTriggeredActionPreviewsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: HOVERINTENT_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Hover-intent dependency "${pkgName}" (${versionRange}) can be modernized with declarative HTML interestfor, interest-delay, and interest / loseinterest events.`,
    };
  },
};

export const interestTriggeredActionPreviewsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['hoverintent', 'hoverIntent', 'mouseenter', 'mouseover', 'focusin'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByInterestInvoker(node, ctx.fileContent)) {
        return;
      }

      const message = matchHoverPreviewCall(node);
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

export const interestTriggeredActionPreviewsPackageRule: AnalyzerRule = {
  id: 'interest-triggered-action-previews/package-hoverintent',
  guideId: 'interest-triggered-action-previews',
  guideHash: INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH,
  summary:
    'Hover-intent dependencies (hoverintent, jquery-hoverintent) for triggering action previews can be modernized with HTML interestfor and interest / loseinterest events.',
  matcher: interestTriggeredActionPreviewsPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares hoverintent or jquery-hoverintent in package.json dependencies to trigger action previews or hovercards after a hover delay.',
    ],
    dropWhen: [
      'Pure CSS :hover style transitions without delayed preview cards or popovers.',
      'Click-triggered dropdown menus or navigation menus unrelated to interest-triggered action previews.',
    ],
  },
};

export const interestTriggeredActionPreviewsJsRule: AnalyzerRule = {
  id: 'interest-triggered-action-previews/js-hover-preview',
  guideId: 'interest-triggered-action-previews',
  guideHash: INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH,
  summary:
    'JavaScript hoverintent(), .hoverIntent(), and mouseenter/focusin + setTimeout hover-intent delays triggering action previews should be modernized with HTML interestfor.',
  matcher: interestTriggeredActionPreviewsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript uses hoverintent() or $(...).hoverIntent() to trigger a preview card, popover, or action preview effect.',
      'Manual mouseenter/mouseleave or focusin debounce timers (setTimeout) trigger action preview popovers or preview dataset states.',
    ],
    dropWhen: [
      'The code is guarded by an "interestForElement" in HTMLButtonElement.prototype, interestfor, or interesttarget feature check.',
      'Pure CSS :hover style transitions or immediate mouseenter analytics tracking without action preview UI.',
      'Click-triggered dropdown menus or modal dialogs.',
    ],
  },
};

export const interestTriggeredActionPreviewsRules: readonly AnalyzerRule[] = [
  interestTriggeredActionPreviewsPackageRule,
  interestTriggeredActionPreviewsJsRule,
];
