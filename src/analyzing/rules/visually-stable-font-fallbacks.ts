import {
  Node,
  SyntaxKind,
  type CallExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
  resolveCallableNode,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH = '223faadbfe12';

const FONT_LOADER_PACKAGES = [
  'fontfaceobserver',
  'webfontloader',
] as const;

const FONT_FALLBACK_GUARD_TOKENS = [
  'font-size-adjust',
  'fontSizeAdjust',
  'size-adjust',
  'ascent-override',
  'descent-override',
] as const;

const CANVAS_CONTEXT_REGEX =
  /\b(?:getContext\s*\(\s*['"]2d['"]\s*\)|fillText|strokeText|measureText)\b/;

function isFontFaceObserverInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isNewExpression(resolved) || Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'FontFaceObserver', ['fontfaceobserver'])) {
      return true;
    }
  }
  return false;
}

function isGuardedByFontAdjust(node: Node, fileContent: string): boolean {
  if (
    /\b(?:font-size-adjust|size-adjust|ascent-override|descent-override)\s*:/i.test(
      fileContent,
    )
  ) {
    return true;
  }
  if (isProtectedByFeatureGuard(node, FONT_FALLBACK_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        FONT_FALLBACK_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function isCanvasFontLoadContext(node: Node): boolean {
  for (const arg of Node.isCallExpression(node) ? node.getArguments() : []) {
    const resolvedArg = resolveCallableNode(arg, 2);
    if (CANVAS_CONTEXT_REGEX.test(resolvedArg.getText())) {
      return true;
    }
  }

  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isCallExpression(current)) {
      for (const arg of current.getArguments()) {
        const resolvedArg = resolveCallableNode(arg, 2);
        if (CANVAS_CONTEXT_REGEX.test(resolvedArg.getText())) {
          return true;
        }
      }
    }
    if (
      Node.isCallExpression(current) ||
      Node.isBlock(current) ||
      Node.isExpressionStatement(current) ||
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      if (CANVAS_CONTEXT_REGEX.test(current.getText())) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchFontLoaderCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'load') {
    const receiver = callee.getExpression();
    if (isFontFaceObserverInstance(receiver)) {
      if (isCanvasFontLoadContext(callExpr)) {
        return null;
      }
      return 'FontFaceObserver.load() fallback font swap script can be modernized with CSS font-size-adjust and @font-face size-adjust / ascent-override.';
    }

    if (
      callExpr.getArguments().length > 0 &&
      isLibraryReference(receiver, 'WebFont', ['webfontloader'])
    ) {
      if (isCanvasFontLoadContext(callExpr)) {
        return null;
      }
      return 'WebFont.load() fallback font class loader can be modernized with CSS font-size-adjust and @font-face size-adjust / ascent-override.';
    }
  }

  return null;
}

export const visuallyStableFontFallbacksPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    FONT_LOADER_PACKAGES,
    (pkgName, versionRange) =>
      `JavaScript font-loading dependency "${pkgName}" (${versionRange}) can be modernized with CSS font-size-adjust and @font-face size-adjust / ascent-override descriptors.`,
  );

export const visuallyStableFontFallbacksJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['FontFaceObserver', 'WebFont', 'fontfaceobserver', 'webfontloader'],
  dedupeLines: true,
  isGuarded: (node, _sourceFile, ctx) => isGuardedByFontAdjust(node, ctx.fileContent),
  matchCall: matchFontLoaderCall,
});

export const visuallyStableFontFallbacksPackageRule: AnalyzerRule = {
  id: 'visually-stable-font-fallbacks/package-font-loader',
  guideId: 'visually-stable-font-fallbacks',
  guideHash: VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH,
  summary:
    'Font-loading observer dependencies (fontfaceobserver, webfontloader) used to mitigate fallback font layout shifts can be modernized with CSS font-size-adjust.',
  matcher: visuallyStableFontFallbacksPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares fontfaceobserver or webfontloader in package.json dependencies to toggle font-loaded classes and mitigate fallback font layout shifts.',
    ],
    dropWhen: [
      'Stylesheets already use @font-face size-adjust, ascent-override, descent-override, or CSS font-size-adjust.',
      'Font loading listeners are used strictly to trigger 2D <canvas> text drawing (ctx.fillText).',
    ],
  },
};

export const visuallyStableFontFallbacksJsRule: AnalyzerRule = {
  id: 'visually-stable-font-fallbacks/js-font-loader',
  guideId: 'visually-stable-font-fallbacks',
  guideHash: VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH,
  summary:
    'JavaScript FontFaceObserver(...).load() and WebFont.load() calls toggling font-loaded classes should be modernized with CSS font-size-adjust and @font-face metric overrides.',
  matcher: visuallyStableFontFallbacksJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls new FontFaceObserver(...).load() or WebFont.load(...) to toggle .fonts-loaded / .wf-active classes and swap fallback font styles.',
      'Manual line-height or letter-spacing adjustments are applied in JS font-loading callbacks to prevent layout shift.',
    ],
    dropWhen: [
      'The code is guarded by CSS.supports("font-size-adjust", ...) or already defines @font-face size-adjust / ascent-override / descent-override.',
      'Font loading callbacks are used exclusively to redraw <canvas> text (fillText / measureText).',
    ],
  },
};

export default [
  visuallyStableFontFallbacksPackageRule,
  visuallyStableFontFallbacksJsRule,
] satisfies readonly AnalyzerRule[];
