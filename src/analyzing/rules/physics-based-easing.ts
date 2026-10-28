import {
  Node,
  SyntaxKind,
  type CallExpression,
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

export const physicsBasedEasingJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['spring', 'popmotion'],
  isGuarded: (node) => isGuardedByResolvedLinearSupport(node),
  matchCall: (node) => matchSpringCall(node),
});

export const physicsBasedEasingJsRule: AnalyzerRule = {
  id: 'physics-based-easing/js-spring',
  guideId: 'physics-based-easing',
  guideHash: PHYSICS_BASED_EASING_GUIDE_HASH,
  summary:
    'JavaScript spring({ stiffness, damping }) calls in popmotion or react-motion should be modernized with the CSS linear() easing function.',
  matcher: physicsBasedEasingJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls spring({ stiffness, damping, ... }) from popmotion or react-motion to interpolate UI element transitions without a CSS.supports("animation-timing-function", "linear(0, 1)") fallback guard.',
    ],
    dropWhen: [
      'The spring() call is inside a fallback branch guarded by !CSS.supports("animation-timing-function", "linear(0, 1)") or similar linear() support check.',
      'The code runs a continuous Canvas/WebGL game physics simulation rather than a declarative UI transition.',
    ],
  },
};

export default [
  physicsBasedEasingJsRule,
] satisfies readonly AnalyzerRule[];
