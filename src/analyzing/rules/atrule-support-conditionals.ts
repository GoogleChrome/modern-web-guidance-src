import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type PropertyAccessExpression,
  type SourceFile,
} from 'ts-morph';
import {
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

export const ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH = 'adca6619584a';

const MODERNIZR_PACKAGES = ['modernizr'] as const;

const MODERNIZR_AT_RULE_PROPERTIES: ReadonlySet<string> = new Set([
  'fontface',
  'keyframes',
  'mediaqueries',
  'supports',
]);

const CSS_RULE_AT_RULE_CONSTANTS: ReadonlySet<string> = new Set([
  'KEYFRAMES_RULE',
  'WEBKIT_KEYFRAMES_RULE',
  'MOZ_KEYFRAMES_RULE',
  'KEYFRAME_RULE',
  'WEBKIT_KEYFRAME_RULE',
  'FONT_FACE_RULE',
  'SUPPORTS_RULE',
  'COUNTER_STYLE_RULE',
  'NAMESPACE_RULE',
  'PAGE_RULE',
  'MEDIA_RULE',
  'IMPORT_RULE',
]);

function isImportedOrRequiredFrom(
  identNode: Node,
  identName: string,
  packages: readonly string[],
): boolean {
  const sourceFile = identNode.getSourceFile();
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (!packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))) {
      continue;
    }
    if (imp.getDefaultImport()?.getText() === identName) {
      return true;
    }
    if (imp.getNamespaceImport()?.getText() === identName) {
      return true;
    }
    for (const named of imp.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      if (local === identName) {
        return true;
      }
    }
  }

  const resolved = resolveLocalExpression(identNode, 2);
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

function isModernizrObject(node: Node): boolean {
  if (isGlobalReference(node, 'Modernizr')) {
    return true;
  }
  const unwrapped = unwrapExpression(node);
  return (
    Node.isIdentifier(unwrapped) &&
    unwrapped.getText() === 'Modernizr' &&
    isImportedOrRequiredFrom(unwrapped, 'Modernizr', MODERNIZR_PACKAGES)
  );
}

function isAtRuleStringNode(node: Node | undefined): boolean {
  if (!node) {
    return false;
  }
  const resolved = resolveLocalExpression(node, 2);
  if (
    Node.isStringLiteral(resolved) ||
    Node.isNoSubstitutionTemplateLiteral(resolved)
  ) {
    return resolved.getLiteralText().trim().startsWith('@');
  }
  return false;
}

function isInsideTryBlock(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isTryStatement(current)) {
      const tryBlock = current.getTryBlock();
      return node.getStart() >= tryBlock.getStart() && node.getEnd() <= tryBlock.getEnd();
    }
    current = current.getParent();
  }
  return false;
}

function matchAtRuleCallExpression(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  if (isModernizrObject(callee.getExpression())) {
    if (methodName === 'atRule') {
      return 'Modernizr.atRule() CSS at-rule feature detection in JavaScript can be modernized with native CSS @supports at-rule(@...).';
    }
    if (methodName === 'testStyles' && isAtRuleStringNode(args[0])) {
      return 'Modernizr.testStyles() CSS at-rule feature probe in JavaScript can be modernized with native CSS @supports at-rule(@...).';
    }
    return null;
  }

  if (methodName === 'insertRule' && isAtRuleStringNode(args[0]) && isInsideTryBlock(callExpr)) {
    return 'Stylesheet insertRule("@...") try/catch probe for CSS at-rule support can be modernized with native CSS @supports at-rule(@...).';
  }

  return null;
}

function isAssignmentTarget(propAccess: PropertyAccessExpression): boolean {
  const parent = propAccess.getParent();
  if (!parent || !Node.isBinaryExpression(parent)) {
    return false;
  }
  return (
    parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
    unwrapExpression(parent.getLeft()) === propAccess
  );
}

function matchAtRulePropertyAccess(
  propAccess: PropertyAccessExpression,
): string | null {
  const parent = propAccess.getParent();
  if (
    parent &&
    Node.isCallExpression(parent) &&
    unwrapExpression(parent.getExpression()) === propAccess
  ) {
    return null;
  }
  if (isAssignmentTarget(propAccess)) {
    return null;
  }

  const receiver = propAccess.getExpression();
  const propName = propAccess.getName();

  if (isModernizrObject(receiver)) {
    if (MODERNIZR_AT_RULE_PROPERTIES.has(propName.toLowerCase())) {
      return `Modernizr.${propName} CSS at-rule check in JavaScript can be modernized with native CSS @supports at-rule(@...).`;
    }
    return null;
  }

  if (isGlobalReference(receiver, 'CSSRule') && CSS_RULE_AT_RULE_CONSTANTS.has(propName)) {
    return `CSSRule.${propName} CSS at-rule support check in JavaScript can be modernized with native CSS @supports at-rule(@...).`;
  }

  return null;
}

function matchCssRuleInOperator(binaryExpr: BinaryExpression): string | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.InKeyword) {
    return null;
  }
  const left = unwrapExpression(binaryExpr.getLeft());
  const right = unwrapExpression(binaryExpr.getRight());
  if (!isGlobalReference(right, 'CSSRule')) {
    return null;
  }
  if (Node.isStringLiteral(left) || Node.isNoSubstitutionTemplateLiteral(left)) {
    const ruleConst = left.getLiteralText();
    if (CSS_RULE_AT_RULE_CONSTANTS.has(ruleConst)) {
      return `"${ruleConst}" in CSSRule at-rule support check in JavaScript can be modernized with native CSS @supports at-rule(@...).`;
    }
  }
  return null;
}

export const atruleSupportConditionalsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: MODERNIZR_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy feature-detection package "${pkgName}" (${versionRange}) can be modernized with native CSS @supports and @supports at-rule(@...).`,
    };
  },
};

export const atruleSupportConditionalsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Modernizr', 'atRule', 'insertRule', 'CSSRule'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (
        isProtectedByFeatureGuard(node, [
          'at-rule(',
          'CSSFunctionRule',
        ])
      ) {
        return;
      }

      if (Node.isCallExpression(node)) {
        const msg = matchAtRuleCallExpression(node);
        const line = node.getStartLineNumber();
        if (msg && !visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({ line, message: msg });
        }
        return;
      }

      if (Node.isPropertyAccessExpression(node)) {
        const msg = matchAtRulePropertyAccess(node);
        const line = node.getStartLineNumber();
        if (msg && !visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({ line, message: msg });
        }
        return;
      }

      if (Node.isBinaryExpression(node)) {
        const msg = matchCssRuleInOperator(node);
        const line = node.getStartLineNumber();
        if (msg && !visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({ line, message: msg });
        }
      }
    });

    return matches;
  },
};

export const atruleSupportConditionalsPackageRule: AnalyzerRule = {
  id: 'atrule-support-conditionals/package-modernizr',
  guideId: 'atrule-support-conditionals',
  guideHash: ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  summary:
    'Legacy Modernizr dependency in package.json used for CSS at-rule conditionals should be modernized with native CSS @supports at-rule(@...).',
  matcher: atruleSupportConditionalsPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares modernizr in package.json dependencies to detect CSS at-rule support.',
    ],
    dropWhen: [
      'Modernizr is used to detect non-CSS browser APIs (WebGL, Canvas, IndexedDB, LocalStorage) or standard CSS properties rather than CSS at-rules.',
      'The codebase already uses native CSS @supports at-rule(@...) for at-rule conditionals.',
    ],
  },
};

export const atruleSupportConditionalsJsRule: AnalyzerRule = {
  id: 'atrule-support-conditionals/js-modernizr',
  guideId: 'atrule-support-conditionals',
  guideHash: ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  summary:
    'JavaScript CSS at-rule support probes (Modernizr.atRule, Modernizr.keyframes, Modernizr.fontface, CSSRule.*_RULE, or stylesheet insertRule("@...") try/catch probes) should be modernized with native CSS @supports at-rule(@...).',
  matcher: atruleSupportConditionalsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls Modernizr.atRule() or reads Modernizr.keyframes / Modernizr.fontface to test whether a CSS at-rule is supported.',
      'JavaScript probes CSSRule.*_RULE constants or executes stylesheet.insertRule("@...") inside a try/catch block to detect CSS at-rule support.',
    ],
    dropWhen: [
      'JavaScript checks standard CSS property/value support (such as Modernizr.flexbox, Modernizr.cssgrid, Modernizr.testProp) or non-CSS HTML5 APIs (such as Modernizr.webgl, Modernizr.canvas, Modernizr.localstorage).',
      'The check is guarded by native CSS.supports("at-rule(@...)") or tests CSSOM rule constructors (e.g. globalThis.CSSFunctionRule) as a progressive enhancement fallback.',
    ],
  },
};

export const atruleSupportConditionalsRules: readonly AnalyzerRule[] = [
  atruleSupportConditionalsJsRule,
];
