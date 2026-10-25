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

export const SLIDER_GUIDE_HASH = '70aeff8bae4d';

const SLIDER_GUARD_TOKENS = [
  'accent-color',
  'accentColor',
] as const;

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

export const sliderJsRule: AnalyzerRule = {
  id: 'slider/js-slider',
  guideId: 'slider',
  guideHash: SLIDER_GUIDE_HASH,
  summary:
    'Single-handle noUiSlider.create() calls should be modernized with native HTML <input type="range"> and CSS accent-color.',
  matcher: sliderJsMatcher,
  verifierRubric: {
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
  sliderJsRule,
];
