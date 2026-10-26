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

export const CLIENT_SIDE_ENCRYPTION_GUIDE_HASH = '29bfbdecb207';

const WEBCRYPTO_GUARD_TOKENS = [
  'subtle',
  'SubtleCrypto',
] as const;

const CRYPTOJS_CIPHERS: ReadonlySet<string> = new Set([
  'AES',
  'TripleDES',
  'Rabbit',
  'RC4',
  'RC4Drop',
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

function isSubmoduleImport(node: Node, packages: readonly string[]): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped)) {
    return false;
  }
  return isLibraryReference(unwrapped, unwrapped.getText(), packages, true, false);
}

function matchEncryptionCall(callExpr: CallExpression): string | null {
  if (callExpr.getArguments().length < 2) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  if (methodName !== 'encrypt' && methodName !== 'decrypt') {
    return null;
  }

  const receiver = unwrapExpression(callee.getExpression());

  if (Node.isPropertyAccessExpression(receiver)) {
    const cipherName = receiver.getName();
    const rootObj = receiver.getExpression();
    if (
      CRYPTOJS_CIPHERS.has(cipherName) &&
      isLibraryReference(rootObj, 'CryptoJS', ['crypto-js'])
    ) {
      return `CryptoJS.${cipherName}.${methodName}() pure-JS encryption can be modernized with the native Web Cryptography API (crypto.subtle.encrypt / decrypt).`;
    }
  }

  if (
    Node.isIdentifier(receiver) &&
    CRYPTOJS_CIPHERS.has(receiver.getText()) &&
    isSubmoduleImport(receiver, ['crypto-js'])
  ) {
    return `${receiver.getText()}.${methodName}() from crypto-js can be modernized with the native Web Cryptography API (crypto.subtle.encrypt / decrypt).`;
  }

  if (isLibraryReference(receiver, 'sjcl', ['sjcl'])) {
    return `sjcl.${methodName}() pure-JS encryption can be modernized with the native Web Cryptography API (crypto.subtle.encrypt / decrypt).`;
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

export const clientSideEncryptionJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['CryptoJS', 'AES', 'sjcl'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByWebCryptoCheck(node)) {
        return;
      }

      const msg = matchEncryptionCall(node);
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

export const clientSideEncryptionJsRule: AnalyzerRule = {
  id: 'client-side-encryption/js-crypto',
  guideId: 'client-side-encryption',
  guideHash: CLIENT_SIDE_ENCRYPTION_GUIDE_HASH,
  summary:
    'JavaScript encryption calls (CryptoJS.AES.encrypt/decrypt, sjcl.encrypt/decrypt) should be modernized with Web Cryptography API (crypto.subtle).',
  matcher: clientSideEncryptionJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls CryptoJS.AES.encrypt(), CryptoJS.AES.decrypt(), sjcl.encrypt(), or sjcl.decrypt() to encrypt or decrypt data in browser code without a crypto.subtle feature guard.',
    ],
    dropWhen: [
      'The encryption call is inside a fallback branch guarded by !window.crypto?.subtle or typeof SubtleCrypto === "undefined".',
      'The code performs non-encryption hashing checksums (e.g. MD5, SHA1) or runs in a server-side Node.js script.',
    ],
  },
};

export const clientSideEncryptionRules: readonly AnalyzerRule[] = [
  clientSideEncryptionJsRule,
];
