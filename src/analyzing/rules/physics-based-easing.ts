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
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const PHYSICS_BASED_EASING_GUIDE_HASH = 'c2dcec13782f';

const SPRING_PACKAGES = [
  'popmotion',
  're-spring',
  'react-motion',
] as const;

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

function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
): boolean {
  if (isGlobalReference(node, identName)) {
    return true;
  }
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped)) {
    return false;
  }
  const localName = unwrapped.getText();
  const sourceFile = unwrapped.getSourceFile();
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = getSafeModuleSpecifier(imp);
    if (!spec || !packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))) {
      continue;
    }
    if (
      localName === identName &&
      (imp.getDefaultImport()?.getText() === localName ||
        imp.getNamespaceImport()?.getText() === localName)
    ) {
      return true;
    }
    for (const named of imp.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      if (local === localName && named.getName() === identName) {
        return true;
      }
    }
  }
  if (localName !== identName) {
    return false;
  }
  const resolved = resolveLocalExpression(unwrapped, 2);
  if (Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    const firstArg = resolved.getArguments()[0];
    if (
      Node.isIdentifier(callee) &&
      callee.getText() === 'require' &&
      firstArg &&
      Node.isStringLiteral(firstArg)
    ) {
      const spec = firstArg.getLiteralText();
      return packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`));
    }
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

export const physicsBasedEasingPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: SPRING_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy spring physics animation package "${pkgName}" (${versionRange}) can be modernized with the native CSS linear() easing function.`,
    };
  },
};

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

export const physicsBasedEasingPackageRule: AnalyzerRule = {
  id: 'physics-based-easing/package-spring',
  guideId: 'physics-based-easing',
  guideHash: PHYSICS_BASED_EASING_GUIDE_HASH,
  summary:
    'JavaScript spring physics animation packages (popmotion, re-spring, react-motion) should be modernized with the CSS linear() easing function.',
  matcher: physicsBasedEasingPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares popmotion, re-spring, or react-motion in package.json dependencies for UI spring/bounce transition animations.',
    ],
    dropWhen: [
      'The stylesheet already uses the CSS linear() easing function.',
      'The code drives interactive 2D/3D canvas/WebGL game physics simulations rather than UI transitions.',
    ],
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
  physicsBasedEasingPackageRule,
  physicsBasedEasingJsRule,
];
