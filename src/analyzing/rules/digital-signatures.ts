import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
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
          isLibraryReference(kjurNode.getExpression(), 'jsrsasign', ['jsrsasign'], {
            allowGlobal: false,
          }));
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
    const namedOnly = { allowDefaultImport: false, allowGlobal: false } as const;
    const isEllipticCtor =
      isLibraryReference(callee, 'ec', ['elliptic'], namedOnly) ||
      isLibraryReference(callee, 'EC', ['elliptic'], namedOnly) ||
      isLibraryReference(callee, 'eddsa', ['elliptic'], namedOnly) ||
      isLibraryReference(callee, 'EdDSA', ['elliptic'], namedOnly);
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

export const digitalSignaturesJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['KJUR', 'nacl', 'elliptic', 'ec', 'EC', 'eddsa', 'EdDSA'],
  isGuarded: (node) => isGuardedByWebCryptoCheck(node),
  matchCall: (node) => matchSignatureCallExpression(node),
  matchNew: (node) => matchSignatureNewExpression(node),
});

export const digitalSignaturesJsRule: AnalyzerRule = {
  id: 'digital-signatures/js-signature',
  guideId: 'digital-signatures',
  guideHash: DIGITAL_SIGNATURES_GUIDE_HASH,
  summary:
    'JavaScript digital signature calls (KJUR.crypto.Signature, nacl.sign, nacl.sign.detached.verify, elliptic) should be modernized with crypto.subtle.sign and crypto.subtle.verify.',
  matcher: digitalSignaturesJsMatcher,
  verifierRubric: {
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
