import {
  Node,
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

export const PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH = '900026d2769b';

const TOAST_GUARD_TOKENS = [
  'popover',
  'showPopover',
  'hidePopover',
  'togglePopover',
] as const;

const NOTYF_METHODS: ReadonlySet<string> = new Set([
  'success',
  'error',
  'open',
]);

const TOASTR_METHODS: ReadonlySet<string> = new Set([
  'info',
  'success',
  'warning',
  'error',
]);

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
        for (const el of param.getDescendantsOfKind(
          identNode.getKind(),
        )) {
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

const COMPLEX_QUEUE_OPTION_KEYS: ReadonlySet<string> = new Set([
  'progressBar',
  'preventDuplicates',
  'maxOpened',
  'newestOnTop',
  'onclick',
  'onCloseClick',
  'tapToDismiss',
]);

function hasComplexQueueOrProgressBarOptions(obj: ObjectLiteralExpression): boolean {
  for (const prop of obj.getProperties()) {
    if (
      Node.isPropertyAssignment(prop) ||
      Node.isShorthandPropertyAssignment(prop) ||
      Node.isMethodDeclaration(prop)
    ) {
      const name = prop.getName();
      if (COMPLEX_QUEUE_OPTION_KEYS.has(name)) {
        const init = Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;
        if (!init || init.getText() !== 'false') {
          return true;
        }
      }
    }
  }
  return false;
}

function matchHandRolledToast(node: CallExpression): string | null {
  const callee = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }
  const methodName = callee.getName();

  // Pattern 1: Chained animation fadeOut following fadeIn/delay
  if (methodName === 'fadeOut' || methodName === 'hide' || methodName === 'slideUp') {
    let walker: Node | undefined = callee.getExpression();
    let hasFadeIn = false;
    let hasSecondarySignal = false;

    while (walker) {
      if (Node.isCallExpression(walker)) {
        const wExpr = walker.getExpression();
        if (Node.isPropertyAccessExpression(wExpr)) {
          const wName = wExpr.getName();
          if (wName === 'fadeIn' || wName === 'show' || wName === 'slideDown') {
            hasFadeIn = true;
          }
          if (wName === 'appendTo') {
            const arg = walker.getArguments()[0]?.getText();
            if (arg && /(?:body|document\.body)/i.test(arg)) {
              hasSecondarySignal = true;
            }
          }
          walker = wExpr.getExpression();
          continue;
        }
      }
      const txt = walker.getText();
      if (/(?:body|top|bottom|fixed|absolute|toast|notification)/i.test(txt)) {
        hasSecondarySignal = true;
      }
      break;
    }

    const parentStmt = node.getParent();
    const enclosingText = parentStmt?.getText() ?? '';
    if (
      !hasSecondarySignal &&
      /(?:body|top|bottom|position:\s*fixed|toast|notification)/i.test(enclosingText)
    ) {
      hasSecondarySignal = true;
    }

    if (hasFadeIn && hasSecondarySignal) {
      return 'Hand-rolled toast notification using animation and DOM insertion can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.';
    }
  }

  // Pattern 2: Toast element appended to body with class "toast" or "notification"
  if (methodName === 'appendTo') {
    const firstArg = node.getArguments()[0]?.getText() ?? '';
    if (/(?:body|document\.body)/i.test(firstArg)) {
      const receiver = callee.getExpression();
      const receiverText = receiver.getText();
      if (/(?:toast|notification)/i.test(receiverText)) {
        return 'DOM toast element appended directly to body can be modernized with native HTML popover="manual" in the top layer.';
      }
    }
  }

  return null;
}

function isToastifyInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isCallExpression(resolved) || Node.isNewExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'Toastify', ['toastify-js'])) {
      const firstArg = resolved.getArguments()[0];
      if (firstArg) {
        const resolvedArg = resolveLocalExpression(firstArg, 2);
        if (
          Node.isObjectLiteralExpression(resolvedArg) &&
          hasComplexQueueOrProgressBarOptions(resolvedArg)
        ) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

function isNotyfInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isNewExpression(resolved) || Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'Notyf', ['notyf'])) {
      const firstArg = resolved.getArguments()[0];
      if (firstArg) {
        const resolvedArg = resolveLocalExpression(firstArg, 2);
        if (
          Node.isObjectLiteralExpression(resolvedArg) &&
          hasComplexQueueOrProgressBarOptions(resolvedArg)
        ) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

function matchToastCall(callExpr: CallExpression): string | null {
  const handRolledMsg = matchHandRolledToast(callExpr);
  if (handRolledMsg) {
    return handRolledMsg;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  const receiver = callee.getExpression();

  if (methodName === 'showToast' && isToastifyInstance(receiver)) {
    return 'Toastify(...).showToast() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.';
  }

  const args = callExpr.getArguments();

  if (
    NOTYF_METHODS.has(methodName) &&
    args.length > 0 &&
    isNotyfInstance(receiver)
  ) {
    const firstArg = args[0];
    if (firstArg) {
      const resolvedFirst = resolveLocalExpression(firstArg, 2);
      if (
        Node.isObjectLiteralExpression(resolvedFirst) &&
        hasComplexQueueOrProgressBarOptions(resolvedFirst)
      ) {
        return null;
      }
    }
    return `new Notyf().${methodName}() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.`;
  }

  if (
    TOASTR_METHODS.has(methodName) &&
    args.length > 0 &&
    args.length <= 3 &&
    isLibraryReference(receiver, 'toastr', ['toastr'])
  ) {
    for (const arg of args) {
      const resolvedArg = resolveLocalExpression(arg, 2);
      if (
        Node.isObjectLiteralExpression(resolvedArg) &&
        hasComplexQueueOrProgressBarOptions(resolvedArg)
      ) {
        return null;
      }
    }
    return `toastr.${methodName}() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.`;
  }

  return null;
}

function fileUsesManualPopoverOrQueueManager(fileContent: string): boolean {
  return (
    /popover\s*=\s*["']manual["']/i.test(fileContent) ||
    fileContent.includes('showPopover') ||
    /\btoastr\.(?:options|clear|remove)\b/.test(fileContent) ||
    /\bdismissAll\s*\(/.test(fileContent)
  );
}

export const persistentToastNotificationsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Toastify', 'Notyf', 'toastr', 'fadeIn', 'fadeOut', 'toast', 'appendTo'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (fileUsesManualPopoverOrQueueManager(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const matchedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const line = node.getStartLineNumber();
      if (matchedLines.has(line)) {
        return;
      }

      const msg = matchToastCall(node);
      if (msg && !isProtectedByFeatureGuard(node, TOAST_GUARD_TOKENS)) {
        matchedLines.add(line);
        matches.push({
          line,
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const persistentToastNotificationsJsRule: AnalyzerRule = {
  id: 'persistent-toast-notifications/js-toast',
  guideId: 'persistent-toast-notifications',
  guideHash: PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH,
  summary:
    'JavaScript toast notification calls (Toastify().showToast, new Notyf().success/error, toastr.info/success/warning/error) should be modernized with HTML popover="manual".',
  matcher: persistentToastNotificationsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript invokes Toastify(...).showToast(), new Notyf().success/error(...), or toastr.info/success/warning/error(...) to display persistent floating toast notifications without native popover="manual".',
      'Custom notification container managers create fixed z-index: 99999 overlays for persistent toast messages.',
    ],
    dropWhen: [
      'The component already uses native <div popover="manual"> with showPopover() and hidePopover() or is guarded by a popover feature check.',
      'The toast relies on multi-toast queue stacking, auto-dismiss timers (duration / timeOut), progress bars, or imperative queue clearing (toastr.clear / dismissAll) that native popover="manual" does not provide.',
      'The code renders blocking modal dialogs (<dialog>) or inline form validation error banners.',
    ],
  },
};

export const persistentToastNotificationsRules: readonly AnalyzerRule[] = [
  persistentToastNotificationsJsRule,
];
