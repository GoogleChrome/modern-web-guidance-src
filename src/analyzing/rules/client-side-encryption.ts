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
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CLIENT_SIDE_ENCRYPTION_GUIDE_HASH = '29bfbdecb207';

const ENCRYPTION_PACKAGES = [
  'crypto-js',
  'sjcl',
] as const;

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

function isSubmoduleImport(node: Node, packages: readonly string[]): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped)) {
    return false;
  }
  const identName = unwrapped.getText();
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
  return false;
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

export const clientSideEncryptionPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: ENCRYPTION_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy pure-JS cryptography library "${pkgName}" (${versionRange}) can be modernized with the native Web Cryptography API (crypto.subtle).`,
    };
  },
};

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

export const clientSideEncryptionPackageRule: AnalyzerRule = {
  id: 'client-side-encryption/package-crypto',
  guideId: 'client-side-encryption',
  guideHash: CLIENT_SIDE_ENCRYPTION_GUIDE_HASH,
  summary:
    'Legacy pure-JS encryption packages (crypto-js, sjcl) should be modernized with the Web Cryptography API (crypto.subtle).',
  matcher: clientSideEncryptionPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares crypto-js or sjcl in package.json dependencies for client-side payload encryption or decryption.',
    ],
    dropWhen: [
      'The code runs exclusively in a server-side Node.js build script or uses Node built-in node:crypto.',
      'The library is used only for legacy MD5 or SHA-1 non-encryption checksums or legacy IE11 polyfills.',
    ],
  },
};

export const clientSideEncryptionJsRule: AnalyzerRule = {
  id: 'client-side-encryption/js-crypto',
  guideId: 'client-side-encryption',
  guideHash: CLIENT_SIDE_ENCRYPTION_GUIDE_HASH,
  summary:
    'JavaScript encryption calls (CryptoJS.AES.encrypt/decrypt, sjcl.encrypt/decrypt) should be modernized with Web Cryptography API (crypto.subtle).',
  matcher: clientSideEncryptionJsMatcher,
  phase2Rubric: {
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
  clientSideEncryptionPackageRule,
  clientSideEncryptionJsRule,
];
