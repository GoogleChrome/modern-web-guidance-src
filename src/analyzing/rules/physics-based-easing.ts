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

export const PHYSICS_BASED_EASING_GUIDE_HASH = 'c2dcec13782f';

const LINEAR_EASING_GUARD_TOKENS = [
  'linear(',
] as const;

const SPRING_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'stiffness',
  'damping',
  'mass',
  'bounce',
  'restDelta',
  'restSpeed',
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

function hasSpringPhysicsProperty(obj: ObjectLiteralExpression): boolean {
  for (const prop of obj.getProperties()) {
    if (
      (Node.isPropertyAssignment(prop) ||
        Node.isShorthandPropertyAssignment(prop)) &&
      SPRING_CONFIG_KEYS.has(prop.getName())
    ) {
      return true;
    }
  }
  return false;
}

function isGuardedByResolvedLinearSupport(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, LINEAR_EASING_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const cond = unwrapExpression(current.getExpression());
      if (
        Node.isPrefixUnaryExpression(cond) &&
        cond.getOperatorToken() === SyntaxKind.ExclamationToken
      ) {
        const resolved = resolveLocalExpression(cond.getOperand(), 2);
        if (resolved.getText().includes('linear(')) {
          return true;
        }
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchSpringCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());

  const isPopmotionMember =
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === 'spring' &&
    isLibraryReference(callee.getExpression(), 'popmotion', ['popmotion']);

  const isSpringFn = isLibraryReference(callee, 'spring', [
    'popmotion',
    'react-motion',
    're-spring',
  ]);

  if (!isPopmotionMember && !isSpringFn) {
    return null;
  }

  const hasPhysicsConfig = args.some((arg) => {
    const resolved = resolveLocalExpression(arg, 2);
    return Node.isObjectLiteralExpression(resolved) && hasSpringPhysicsProperty(resolved);
  });

  if (!hasPhysicsConfig) {
    return null;
  }

  return 'JavaScript spring({ stiffness, damping }) physics animation can be modernized with the native CSS linear() easing function.';
}

export const physicsBasedEasingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['spring', 'popmotion'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByResolvedLinearSupport(node)) {
        return;
      }

      const msg = matchSpringCall(node);
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

export const physicsBasedEasingJsRule: AnalyzerRule = {
  id: 'physics-based-easing/js-spring',
  guideId: 'physics-based-easing',
  guideHash: PHYSICS_BASED_EASING_GUIDE_HASH,
  summary:
    'JavaScript spring({ stiffness, damping }) calls in popmotion or react-motion should be modernized with the CSS linear() easing function.',
  matcher: physicsBasedEasingJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls spring({ stiffness, damping, ... }) from popmotion or react-motion to interpolate UI element transitions without a CSS.supports("animation-timing-function", "linear(0, 1)") fallback guard.',
    ],
    dropWhen: [
      'The spring() call is inside a fallback branch guarded by !CSS.supports("animation-timing-function", "linear(0, 1)") or similar linear() support check.',
      'The code runs a continuous Canvas/WebGL game physics simulation rather than a declarative UI transition.',
    ],
  },
};

export const physicsBasedEasingRules: readonly AnalyzerRule[] = [
  physicsBasedEasingJsRule,
];
