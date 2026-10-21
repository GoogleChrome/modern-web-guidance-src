import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
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

export const CONDITIONAL_ASYNC_DEPENDENCIES_GUIDE_HASH = 'c26cf4b37462';

const SCRIPT_LOADER_PACKAGES = [
  'loadjs',
  'scriptjs',
] as const;

const THIRD_PARTY_SCRIPT_REGEX =
  /google-analytics|googletagmanager|gtag|gtm\.js|analytics\.js|fbevents|connect\.facebook|doubleclick|googlesyndication|adsbygoogle|stripe\.com|js\.stripe|paypal\.com|sentry\.io|hotjar|intercom|segment\.com|mixpanel|amplitude|clarity\.ms|hs-scripts|hubspot|zdassets|disqus|platform\.twitter|maps\.googleapis|recaptcha|hcaptcha|turnstile/i;

const NON_JS_SCRIPT_TYPE_REGEX =
  /application\/(?:ld\+json|json)|importmap|speculationrules/i;

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

function isDocumentCreateScriptCall(callExpr: CallExpression): boolean {
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return false;
  }
  const firstArg = unwrapExpression(args[0]);
  if (
    (!Node.isStringLiteral(firstArg) && !Node.isNoSubstitutionTemplateLiteral(firstArg)) ||
    firstArg.getLiteralText().toLowerCase() !== 'script'
  ) {
    return false;
  }
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'createElement') {
    return false;
  }
  return isGlobalReference(callee.getExpression(), 'document');
}

function getEnclosingScopeNode(node: Node): Node {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (
      Node.isBlock(current) ||
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isSourceFile(current)
    ) {
      return current;
    }
    current = current.getParent();
  }
  return node.getSourceFile();
}

function isInsideConditionalFeatureCheck(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isIfStatement(current) ||
      Node.isConditionalExpression(current) ||
      (Node.isBinaryExpression(current) &&
        (current.getOperatorToken().getKind() === SyntaxKind.BarBarToken ||
          current.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken))
    ) {
      return true;
    }
    current = current.getParent();
  }
  return false;
}

function matchCreateScriptInjection(callExpr: CallExpression): string | null {
  if (!isDocumentCreateScriptCall(callExpr)) {
    return null;
  }

  const scopeNode = getEnclosingScopeNode(callExpr);
  const scopeText = scopeNode.getText();

  if (
    THIRD_PARTY_SCRIPT_REGEX.test(scopeText) ||
    NON_JS_SCRIPT_TYPE_REGEX.test(scopeText)
  ) {
    return null;
  }

  const hasSrcAssignment =
    /\.src\s*=/.test(scopeText) ||
    /\.setAttribute\s*\(\s*['"]src['"]/.test(scopeText);
  if (!hasSrcAssignment) {
    return null;
  }

  const hasLoadCallback =
    /\.onload\s*=/.test(scopeText) ||
    /\.onreadystatechange\s*=/.test(scopeText) ||
    /\.addEventListener\s*\(\s*['"]load['"]/.test(scopeText);

  if (!hasLoadCallback && !isInsideConditionalFeatureCheck(callExpr)) {
    return null;
  }

  return 'Dynamic <script> injection via document.createElement("script") can be modernized with dynamic import() and top-level await.';
}

function matchScriptLoaderCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const callText = callExpr.getText();
  if (THIRD_PARTY_SCRIPT_REGEX.test(callText)) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());

  if (isLibraryReference(callee, 'loadjs', ['loadjs'])) {
    return 'loadjs() async dependency loader can be modernized with dynamic import() and top-level await.';
  }

  if (
    isLibraryReference(callee, '$script', ['scriptjs']) ||
    isLibraryReference(callee, 'scriptjs', ['scriptjs'])
  ) {
    return '$script() async dependency loader can be modernized with dynamic import() and top-level await.';
  }

  return matchCreateScriptInjection(callExpr);
}

export const conditionalAsyncDependenciesPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: SCRIPT_LOADER_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Async script loader dependency "${pkgName}" (${versionRange}) can be modernized with native ES module dynamic import() and top-level await.`,
    };
  },
};

export const conditionalAsyncDependenciesJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['loadjs', '$script', 'scriptjs', 'createElement'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const message = matchScriptLoaderCall(node);
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

export const conditionalAsyncDependenciesPackageRule: AnalyzerRule = {
  id: 'conditional-async-dependencies/package-script-loader',
  guideId: 'conditional-async-dependencies',
  guideHash: CONDITIONAL_ASYNC_DEPENDENCIES_GUIDE_HASH,
  summary:
    'Async script loader dependencies (loadjs, scriptjs) for conditional dependency loading can be modernized with dynamic import() and top-level await.',
  matcher: conditionalAsyncDependenciesPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares loadjs or scriptjs in package.json dependencies to load conditional polyfills or asynchronous module dependencies.',
    ],
    dropWhen: [
      'Third-party analytics snippet injection (e.g. Google Tag Manager, Google Analytics, Stripe).',
      'Web Worker importScripts calls.',
    ],
  },
};

export const conditionalAsyncDependenciesJsRule: AnalyzerRule = {
  id: 'conditional-async-dependencies/js-script-loader',
  guideId: 'conditional-async-dependencies',
  guideHash: CONDITIONAL_ASYNC_DEPENDENCIES_GUIDE_HASH,
  summary:
    'JavaScript loadjs(), $script(), and conditional document.createElement("script") dependency loaders should be modernized with dynamic import() and top-level await.',
  matcher: conditionalAsyncDependenciesJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls loadjs(...) or $script(...) to load conditional polyfills or local/module dependencies.',
      'Helper functions or feature-detection blocks dynamically create <script> elements with .src and .onload / addEventListener("load", ...) to load conditional modules.',
    ],
    dropWhen: [
      'Third-party analytics, tag manager, ad, or payment widget snippet injection (e.g. Google Tag Manager, Google Analytics, Stripe).',
      'Web Worker importScripts calls or inline JSON-LD <script type="application/ld+json"> elements.',
    ],
  },
};

export const conditionalAsyncDependenciesRules: readonly AnalyzerRule[] = [
  conditionalAsyncDependenciesPackageRule,
  conditionalAsyncDependenciesJsRule,
];
