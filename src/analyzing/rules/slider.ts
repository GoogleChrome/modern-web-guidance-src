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

export const SLIDER_GUIDE_HASH = '70aeff8bae4d';

const SLIDER_PACKAGES = [
  'nouislider',
  'rc-slider',
  'ion-rangeslider',
] as const;

const SLIDER_GUARD_TOKENS = [
  'accent-color',
  'accentColor',
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

function isNumericValueNode(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isNumericLiteral(unwrapped)) {
    return true;
  }
  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    (unwrapped.getOperatorToken() === SyntaxKind.MinusToken ||
      unwrapped.getOperatorToken() === SyntaxKind.PlusToken)
  ) {
    return Node.isNumericLiteral(unwrapExpression(unwrapped.getOperand()));
  }
  return false;
}

function isSingleHandleStartOption(optionsObj: ObjectLiteralExpression): boolean {
  const startProp = optionsObj.getProperty('start');
  if (!startProp || !Node.isPropertyAssignment(startProp)) {
    return false;
  }
  const init = startProp.getInitializer();
  if (!init) {
    return false;
  }
  const resolved = resolveLocalExpression(init, 2);
  if (isNumericValueNode(resolved)) {
    return true;
  }
  if (Node.isArrayLiteralExpression(resolved)) {
    const elements = resolved.getElements();
    if (elements.length === 1 && elements[0]) {
      return isNumericValueNode(resolveLocalExpression(elements[0], 2));
    }
    return false;
  }
  return false;
}

function matchNoUiSliderCreate(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'create') {
    return null;
  }

  const receiver = callee.getExpression();
  if (
    !isLibraryReference(receiver, 'noUiSlider', ['nouislider']) &&
    !isLibraryReference(receiver, 'nouislider', ['nouislider'])
  ) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 2 || !args[1]) {
    return null;
  }

  const optionsNode = resolveLocalExpression(args[1], 2);
  if (!Node.isObjectLiteralExpression(optionsNode)) {
    return null;
  }

  if (!isSingleHandleStartOption(optionsNode)) {
    return null;
  }

  return 'Single-handle noUiSlider.create() instance can be modernized with a native <input type="range"> styled with CSS accent-color and slider pseudo-elements.';
}

export const sliderPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: SLIDER_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy range slider package "${pkgName}" (${versionRange}) can be modernized with native <input type="range"> and CSS accent-color.`,
    };
  },
};

export const sliderJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['noUiSlider', 'nouislider'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, SLIDER_GUARD_TOKENS)) {
        return;
      }

      const msg = matchNoUiSliderCreate(node);
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

export const sliderPackageRule: AnalyzerRule = {
  id: 'slider/package-slider',
  guideId: 'slider',
  guideHash: SLIDER_GUIDE_HASH,
  summary:
    'Legacy slider packages (nouislider, rc-slider, ion-rangeslider) for single-value sliders should be modernized with native <input type="range"> and CSS accent-color.',
  matcher: sliderPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares nouislider, rc-slider, or ion-rangeslider in package.json dependencies for basic single-value range sliders.',
    ],
    dropWhen: [
      'The slider is a dual-handle or multi-thumb range slider (min and max thumbs) or multi-thumb timeline video scrubbing bar.',
      'The code already uses standard <input type="range"> elements styled with CSS accent-color.',
    ],
  },
};

export const sliderJsRule: AnalyzerRule = {
  id: 'slider/js-slider',
  guideId: 'slider',
  guideHash: SLIDER_GUIDE_HASH,
  summary:
    'Single-handle noUiSlider.create() calls should be modernized with native HTML <input type="range"> and CSS accent-color.',
  matcher: sliderJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls noUiSlider.create() with a single numeric start value (e.g., start: 50 or start: [50]) to build a basic single-thumb range slider.',
      'Custom drag handle divs calculate percentage left offsets on mousemove for a single numeric value.',
    ],
    dropWhen: [
      'The slider configures multiple handles or thumbs (e.g., start: [20, 80]) for min/max interval selection.',
      'The control is a multi-thumb timeline video scrubbing bar or already uses native <input type="range">.',
    ],
  },
};

export const sliderRules: readonly AnalyzerRule[] = [
  sliderPackageRule,
  sliderJsRule,
];
