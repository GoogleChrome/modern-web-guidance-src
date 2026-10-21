import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
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

export const DIGITAL_SIGNATURES_GUIDE_HASH = 'bdc97c626bd6';

const WEBCRYPTO_GUARD_TOKENS = [
  'subtle',
  'SubtleCrypto',
] as const;

const NACL_SIGN_METHODS: ReadonlySet<string> = new Set([
  'open',
  'detached',
  'keyPair',
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

function isNaclSignObject(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isPropertyAccessExpression(unwrapped) || unwrapped.getName() !== 'sign') {
    return false;
  }
  return isLibraryReference(unwrapped.getExpression(), 'nacl', ['tweetnacl']);
}

function isUnsupportedEllipticCurve(args: readonly Node[]): boolean {
  const firstArg = args[0];
  if (!firstArg) {
    return false;
  }
  const directText = firstArg.getText();
  const resolvedText = resolveLocalExpression(firstArg, 2).getText();
  return /secp256k1/i.test(directText) || /secp256k1/i.test(resolvedText);
}

function matchSignatureNewExpression(newExpr: NewExpression): string | null {
  const callee = unwrapExpression(newExpr.getExpression());

  if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'Signature') {
    const cryptoObj = unwrapExpression(callee.getExpression());
    if (Node.isPropertyAccessExpression(cryptoObj) && cryptoObj.getName() === 'crypto') {
      const kjurNode = unwrapExpression(cryptoObj.getExpression());
      const isKjurRef =
        isLibraryReference(kjurNode, 'KJUR', ['jsrsasign']) ||
        (Node.isPropertyAccessExpression(kjurNode) &&
          kjurNode.getName() === 'KJUR' &&
          isLibraryReference(kjurNode.getExpression(), 'jsrsasign', ['jsrsasign'], true, false));
      if (isKjurRef) {
        return 'new KJUR.crypto.Signature() digital signature can be modernized with the native Web Cryptography API (crypto.subtle.sign / verify).';
      }
    }
  }

  if (
    Node.isPropertyAccessExpression(callee) &&
    (callee.getName() === 'ec' || callee.getName() === 'eddsa') &&
    isLibraryReference(callee.getExpression(), 'elliptic', ['elliptic'])
  ) {
    if (isUnsupportedEllipticCurve(newExpr.getArguments())) {
      return null;
    }
    return `new elliptic.${callee.getName()}() signature instance can be modernized with the native Web Cryptography API (crypto.subtle.sign / verify).`;
  }

  if (Node.isIdentifier(callee)) {
    const isEllipticCtor =
      isLibraryReference(callee, 'ec', ['elliptic'], false, false) ||
      isLibraryReference(callee, 'EC', ['elliptic'], false, false) ||
      isLibraryReference(callee, 'eddsa', ['elliptic'], false, false) ||
      isLibraryReference(callee, 'EdDSA', ['elliptic'], false, false);
    if (isEllipticCtor) {
      if (isUnsupportedEllipticCurve(newExpr.getArguments())) {
        return null;
      }
      return `new ${callee.getText()}() from elliptic can be modernized with the native Web Cryptography API (crypto.subtle.sign / verify).`;
    }
  }

  return null;
}

function isGuardedByWebCryptoCheck(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, WEBCRYPTO_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        WEBCRYPTO_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function matchSignatureCallExpression(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  if (isNaclSignObject(callee)) {
    return 'nacl.sign() digital signature call can be modernized with the native Web Cryptography API (crypto.subtle.sign / verify).';
  }

  const methodName = callee.getName();
  const receiver = unwrapExpression(callee.getExpression());

  if (NACL_SIGN_METHODS.has(methodName) && isNaclSignObject(receiver)) {
    return `nacl.sign.${methodName}() digital signature call can be modernized with the native Web Cryptography API (crypto.subtle.sign / verify).`;
  }

  if (
    methodName === 'verify' &&
    Node.isPropertyAccessExpression(receiver) &&
    receiver.getName() === 'detached' &&
    isNaclSignObject(receiver.getExpression())
  ) {
    return 'nacl.sign.detached.verify() signature verification can be modernized with the native Web Cryptography API (crypto.subtle.verify).';
  }

  return null;
}

export const digitalSignaturesJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['KJUR', 'nacl', 'elliptic', 'ec', 'EC', 'eddsa', 'EdDSA'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isNewExpression(node) && !Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByWebCryptoCheck(node)) {
        return;
      }

      const msg = Node.isNewExpression(node)
        ? matchSignatureNewExpression(node)
        : matchSignatureCallExpression(node);

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

export const digitalSignaturesJsRule: AnalyzerRule = {
  id: 'digital-signatures/js-signature',
  guideId: 'digital-signatures',
  guideHash: DIGITAL_SIGNATURES_GUIDE_HASH,
  summary:
    'JavaScript digital signature calls (KJUR.crypto.Signature, nacl.sign, nacl.sign.detached.verify, elliptic) should be modernized with crypto.subtle.sign and crypto.subtle.verify.',
  matcher: digitalSignaturesJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript instantiates KJUR.crypto.Signature or elliptic.ec/eddsa or invokes nacl.sign / nacl.sign.detached.verify to sign or verify messages in browser code.',
    ],
    dropWhen: [
      'The signature logic is guarded by a crypto.subtle / SubtleCrypto feature check.',
      'The code runs in a server-side Node.js build pipeline or performs non-cryptographic checksums (MurmurHash, CRC32).',
    ],
  },
};

export const digitalSignaturesRules: readonly AnalyzerRule[] = [
  digitalSignaturesJsRule,
];
