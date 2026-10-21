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

export const INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH = '7285e209e32e';

const TOOLTIP_PACKAGES = [
  'tippy.js',
  '@tippyjs/react',
  'floating-vue',
  'v-tooltip',
] as const;

const INTEREST_GUARD_TOKENS = [
  'interestfor',
  'interesttarget',
  'popover',
] as const;

function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
): boolean {
  if (isGlobalReference(node, identName)) {
    return true;
  }
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped) || unwrapped.getText() !== identName) {
    return false;
  }
  const sourceFile = unwrapped.getSourceFile();
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = getSafeModuleSpecifier(imp);
    if (!spec || !packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))) {
      continue;
    }
    if (
      imp.getDefaultImport()?.getText() === identName ||
      imp.getNamespaceImport()?.getText() === identName
    ) {
      return true;
    }
    for (const named of imp.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      if (local === identName) {
        return true;
      }
    }
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

function isInteractiveOrClickPopoverConfig(optionsObj: ObjectLiteralExpression): boolean {
  const interactiveProp = optionsObj.getProperty('interactive');
  if (interactiveProp && Node.isPropertyAssignment(interactiveProp)) {
    const init = interactiveProp.getInitializer();
    if (init && unwrapExpression(init).getKind() === SyntaxKind.TrueKeyword) {
      return true;
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
  if (args.length === 0) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!isLibraryReference(callee, 'tippy', ['tippy.js', '@tippyjs/react'])) {
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

export const interestTriggeredTooltipsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: TOOLTIP_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy tooltip library "${pkgName}" (${versionRange}) can be modernized with declarative HTML interestfor, popover="hint", and CSS Anchor Positioning.`,
    };
  },
};

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

export const interestTriggeredTooltipsPackageRule: AnalyzerRule = {
  id: 'interest-triggered-tooltips/package-tooltip',
  guideId: 'interest-triggered-tooltips',
  guideHash: INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH,
  summary:
    'Tooltip libraries (tippy.js, @tippyjs/react, floating-vue, v-tooltip) should be modernized with HTML interestfor, popover="hint", and CSS Anchor Positioning.',
  matcher: interestTriggeredTooltipsPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares tippy.js, @tippyjs/react, floating-vue, or v-tooltip in package.json dependencies for hover/focus tooltips.',
    ],
    dropWhen: [
      'The code uses native HTML title attributes or static pure-CSS [data-tooltip]::after tooltips.',
      'The library is used exclusively for click-triggered interactive dropdown menus or forms rather than interest-triggered tooltips.',
    ],
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
  interestTriggeredTooltipsPackageRule,
  interestTriggeredTooltipsJsRule,
];
