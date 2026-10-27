import {
  Node,
  SyntaxKind,
  type CallExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
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

function isSubmoduleImport(node: Node, packages: readonly string[]): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped)) {
    return false;
  }
  return isLibraryReference(unwrapped, unwrapped.getText(), packages, {
    allowGlobal: false,
  });
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

export const clientSideEncryptionJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['CryptoJS', 'AES', 'sjcl'],
  isGuarded: (node) => isGuardedByWebCryptoCheck(node),
  matchCall: (node) => matchEncryptionCall(node),
});

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

export default [
  clientSideEncryptionJsRule,
] satisfies readonly AnalyzerRule[];
