import {
  Node,
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
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const DIGITAL_SIGNATURES_GUIDE_HASH = 'bdc97c626bd6';

const SIGNATURE_PACKAGES = [
  'jsrsasign',
  'tweetnacl',
  'elliptic',
] as const;

const WEBCRYPTO_GUARD_TOKENS = [
  'subtle',
  'SubtleCrypto',
] as const;

const NACL_SIGN_METHODS: ReadonlySet<string> = new Set([
  'open',
  'detached',
  'keyPair',
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

function isNaclSignObject(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isPropertyAccessExpression(unwrapped) || unwrapped.getName() !== 'sign') {
    return false;
  }
  return isLibraryReference(unwrapped.getExpression(), 'nacl', ['tweetnacl']);
}

function matchSignatureNewExpression(newExpr: NewExpression): string | null {
  const callee = unwrapExpression(newExpr.getExpression());

  if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'Signature') {
    const cryptoObj = unwrapExpression(callee.getExpression());
    if (
      Node.isPropertyAccessExpression(cryptoObj) &&
      cryptoObj.getName() === 'crypto' &&
      isLibraryReference(cryptoObj.getExpression(), 'KJUR', ['jsrsasign'])
    ) {
      return 'new KJUR.crypto.Signature() digital signature can be modernized with the native Web Cryptography API (crypto.subtle.sign / verify).';
    }
  }

  if (
    Node.isPropertyAccessExpression(callee) &&
    (callee.getName() === 'ec' || callee.getName() === 'eddsa') &&
    isLibraryReference(callee.getExpression(), 'elliptic', ['elliptic'])
  ) {
    return `new elliptic.${callee.getName()}() signature instance can be modernized with the native Web Cryptography API (crypto.subtle.sign / verify).`;
  }

  if (
    Node.isIdentifier(callee) &&
    (callee.getText() === 'ec' ||
      callee.getText() === 'EC' ||
      callee.getText() === 'eddsa' ||
      callee.getText() === 'EdDSA') &&
    !isGlobalReference(callee, callee.getText()) &&
    isLibraryReference(callee, callee.getText(), ['elliptic'])
  ) {
    return `new ${callee.getText()}() from elliptic can be modernized with the native Web Cryptography API (crypto.subtle.sign / verify).`;
  }

  return null;
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

export const digitalSignaturesPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: SIGNATURE_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy digital signature package "${pkgName}" (${versionRange}) can be modernized with the native Web Cryptography API (crypto.subtle.sign and crypto.subtle.verify).`,
    };
  },
};

export const digitalSignaturesJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['KJUR', 'nacl', 'elliptic', 'ec', 'EC', 'eddsa', 'EdDSA'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isNewExpression(node) && !Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, WEBCRYPTO_GUARD_TOKENS)) {
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

export const digitalSignaturesPackageRule: AnalyzerRule = {
  id: 'digital-signatures/package-signature',
  guideId: 'digital-signatures',
  guideHash: DIGITAL_SIGNATURES_GUIDE_HASH,
  summary:
    'Legacy pure-JS digital signature packages (jsrsasign, tweetnacl, elliptic) should be modernized with Web Cryptography API (crypto.subtle.sign / verify).',
  matcher: digitalSignaturesPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares jsrsasign, tweetnacl, or elliptic in package.json dependencies for digital signature creation or verification in browser code.',
    ],
    dropWhen: [
      'The code already uses the Web Cryptography API (crypto.subtle.sign / verify).',
      'The package is used only in server-side Node.js JWT signing build pipelines or for non-cryptographic hashing (MurmurHash, CRC32).',
    ],
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
  digitalSignaturesPackageRule,
  digitalSignaturesJsRule,
];
