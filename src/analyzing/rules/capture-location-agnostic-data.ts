import {
  Node,
  SyntaxKind,
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
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH = '0d07f947a04e';

const ISO_LOOKUP_PACKAGES = [
  'i18n-iso-countries',
  'country-list',
  'iso-639-1',
] as const;

const ISO_LOOKUP_OBJECTS = new Set([
  'countries',
  'isoCountries',
  'countryList',
  'ISO6391',
  'iso6391',
]);

const DISPLAY_NAME_METHODS = new Set(['getName']);

const EXCLUDED_CODE_CONVERSION_OR_VALIDATION_METHODS = new Set([
  'getAlpha2Code',
  'getAlpha3Code',
  'getSimpleAlpha2Code',
  'getSimpleAlpha3Code',
  'alpha2ToAlpha3',
  'alpha3ToAlpha2',
  'alpha2ToNumeric',
  'numericToAlpha2',
  'numericToAlpha3',
  'getAlpha2Codes',
  'getAlpha3Codes',
  'getNumericCodes',
  'getNumericCode',
  'toAlpha2',
  'toAlpha3',
  'getAllCodes',
  'isValid',
  'validate',
  'getCode',
  'getCodes',
]);

const GUARD_TOKENS = [
  'DisplayNames',
  'Intl.DisplayNames',
  'Temporal',
  'PlainDate',
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
  if (isRequireOfPackage(callee, packages)) {
    return true;
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
        const paramNameNode = param.getNameNode();
        if (Node.isIdentifier(paramNameNode) && paramNameNode.getText() === localName) {
          return 'shadowed';
        }
        for (const el of paramNameNode.getDescendantsOfKind(SyntaxKind.Identifier)) {
          if (el.getText() === localName) {
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
  allowGlobal: boolean = false,
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

function isVerifiedIsoReceiver(receiver: Node): boolean {
  const unwrapped = unwrapExpression(receiver);
  if (!Node.isIdentifier(unwrapped)) {
    return false;
  }
  const objName = unwrapped.getText();
  if (!ISO_LOOKUP_OBJECTS.has(objName)) {
    return false;
  }
  if (objName === 'ISO6391') {
    return isLibraryReference(unwrapped, 'ISO6391', ISO_LOOKUP_PACKAGES, true, true);
  }
  return isLibraryReference(unwrapped, objName, ISO_LOOKUP_PACKAGES, true, false);
}

function fileUsesCodeConversionOrValidation(sourceFile: SourceFile): boolean {
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = unwrapExpression(call.getExpression());
    if (!Node.isPropertyAccessExpression(callee)) {
      continue;
    }
    const methodName = callee.getName();
    if (!EXCLUDED_CODE_CONVERSION_OR_VALIDATION_METHODS.has(methodName)) {
      continue;
    }
    const receiver = unwrapExpression(callee.getExpression());
    if (Node.isIdentifier(receiver) && ISO_LOOKUP_OBJECTS.has(receiver.getText())) {
      return true;
    }
  }
  return false;
}

function matchIsoDisplayNameCall(callExpr: CallExpression): string | null {
  if (callExpr.getArguments().length === 0) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  if (EXCLUDED_CODE_CONVERSION_OR_VALIDATION_METHODS.has(methodName)) {
    return null;
  }
  if (!DISPLAY_NAME_METHODS.has(methodName)) {
    return null;
  }

  const receiver = unwrapExpression(callee.getExpression());
  if (!Node.isIdentifier(receiver) || !isVerifiedIsoReceiver(receiver)) {
    return null;
  }
  const objName = receiver.getText();

  return `${objName}.${methodName}() ISO display-name lookup can be modernized with native Intl.DisplayNames and location-agnostic Temporal/Intl primitives.`;
}

export const captureLocationAgnosticDataJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['countries', 'ISO6391', 'countryList', 'getName'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (fileUsesCodeConversionOrValidation(sourceFile)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, GUARD_TOKENS)) {
        return;
      }

      const msg = matchIsoDisplayNameCall(node);
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

export const captureLocationAgnosticDataJsRule: AnalyzerRule = {
  id: 'capture-location-agnostic-data/js-iso-lookup',
  guideId: 'capture-location-agnostic-data',
  guideHash: CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH,
  summary:
    'JavaScript calls to countries.getName(), countryList.getName(), or ISO6391.getName() used solely for single-code display-name translation can be modernized with native Intl.DisplayNames.',
  matcher: captureLocationAgnosticDataJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls countries.getName(...), countryList.getName(...), or ISO6391.getName(...) exclusively for translating a single ISO country or language code into a localized display name.',
    ],
    dropWhen: [
      'The code calls getNames() to enumerate all country codes/names or calls getAlpha2Code(), getAlpha3Code(), alpha2ToAlpha3(), alpha3ToAlpha2(), isValid(), validate(), or getCode() for reverse lookup, code format conversion, or validation.',
      'The call is guarded by Intl.DisplayNames or Temporal feature detection.',
      'The lookup is on a local application object rather than i18n-iso-countries, country-list, or iso-639-1.',
    ],
  },
};

export const captureLocationAgnosticDataRules: readonly AnalyzerRule[] = [
  captureLocationAgnosticDataJsRule,
];
