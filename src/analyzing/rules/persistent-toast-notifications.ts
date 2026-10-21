import {
  Node,
  type CallExpression,
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

export const PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH = '900026d2769b';

const TOAST_PACKAGES = [
  'toastify-js',
  'notyf',
  'react-toastify',
  'toastr',
] as const;

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

function isToastifyInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isCallExpression(resolved) || Node.isNewExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'Toastify', ['toastify-js'])) {
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
      return true;
    }
  }
  return false;
}

function matchToastCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  const receiver = callee.getExpression();

  if (methodName === 'showToast' && isToastifyInstance(receiver)) {
    return 'Toastify(...).showToast() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.';
  }

  if (
    NOTYF_METHODS.has(methodName) &&
    callExpr.getArguments().length > 0 &&
    isNotyfInstance(receiver)
  ) {
    return `new Notyf().${methodName}() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.`;
  }

  if (
    TOASTR_METHODS.has(methodName) &&
    callExpr.getArguments().length > 0 &&
    isLibraryReference(receiver, 'toastr', ['toastr'])
  ) {
    return `toastr.${methodName}() notification can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior: allow-discrete.`;
  }

  return null;
}

function fileUsesManualPopover(fileContent: string): boolean {
  return (
    /popover\s*=\s*["']manual["']/i.test(fileContent) ||
    fileContent.includes('showPopover')
  );
}

export const persistentToastNotificationsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: TOAST_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy toast notification library "${pkgName}" (${versionRange}) can be modernized with native HTML popover="manual", CSS Anchor Positioning, and transition-behavior.`,
    };
  },
};

export const persistentToastNotificationsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Toastify', 'Notyf', 'toastr'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (fileUsesManualPopover(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, TOAST_GUARD_TOKENS)) {
        return;
      }

      const msg = matchToastCall(node);
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

export const persistentToastNotificationsPackageRule: AnalyzerRule = {
  id: 'persistent-toast-notifications/package-toast',
  guideId: 'persistent-toast-notifications',
  guideHash: PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH,
  summary:
    'Toast notification libraries (toastify-js, notyf, react-toastify, toastr) should be modernized with HTML popover="manual", CSS Anchor Positioning, and transition-behavior.',
  matcher: persistentToastNotificationsPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares toastify-js, notyf, react-toastify, or toastr in package.json dependencies to render non-modal toast notifications.',
    ],
    dropWhen: [
      'The code renders persistent system modal alerts that require blocking user confirmation via <dialog>.',
      'The code displays inline form validation error banners rather than floating toast notifications.',
    ],
  },
};

export const persistentToastNotificationsJsRule: AnalyzerRule = {
  id: 'persistent-toast-notifications/js-toast',
  guideId: 'persistent-toast-notifications',
  guideHash: PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH,
  summary:
    'JavaScript toast notification calls (Toastify().showToast, new Notyf().success/error, toastr.info/success/warning/error) should be modernized with HTML popover="manual".',
  matcher: persistentToastNotificationsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript invokes Toastify(...).showToast(), new Notyf().success/error(...), or toastr.info/success/warning/error(...) to display floating toast notifications without native popover="manual".',
      'Custom notification container managers create fixed z-index: 99999 overlays for transient toast messages.',
    ],
    dropWhen: [
      'The component already uses native <div popover="manual"> with showPopover() and hidePopover() or is guarded by a popover feature check.',
      'The code renders blocking modal dialogs (<dialog>) or inline form validation error banners.',
    ],
  },
};

export const persistentToastNotificationsRules: readonly AnalyzerRule[] = [
  persistentToastNotificationsJsRule,
];
