import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project, type SourceFile } from 'ts-morph';
import type { Document } from 'linkedom';

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const currentFileUrl: string =
  typeof __filename !== 'undefined'
    ? pathToFileURL(__filename).href
    : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;

const targetFiles: string[] = getTargetFiles(currentFileUrl);

function getAppSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sf) => {
    const filePath = sf.getFilePath();
    return (
      !filePath.endsWith('.d.ts') &&
      !filePath.includes('/tests/') &&
      !filePath.includes('.test.') &&
      !filePath.includes('test-fixture') &&
      !filePath.includes('grader')
    );
  });
}

function hasSubtleCryptoSupports(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let hasSubtleRef = false;
  let hasCall = false;

  for (const sf of sourceFiles) {
    if (sf.getFullText().includes('SubtleCrypto')) {
      hasSubtleRef = true;
    }

    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression().getText();
      if (expr.endsWith('.supports') || expr === 'supports') {
        const args = call.getArguments().map((a) => a.getText());
        const matchesModernOpOrAlgo = args.some(
          (arg) =>
            arg.includes('encapsulateKey') ||
            arg.includes('decapsulateKey') ||
            arg.includes('MLKEM') ||
            arg.includes('ML-KEM') ||
            arg.includes('ChaCha20')
        );
        if (matchesModernOpOrAlgo) {
          hasCall = true;
        }
      }
    }
  }

  return hasSubtleRef && hasCall;
}

function hasClassicalWebCryptoFallback(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let hasAsymmetricKey = false;
  let hasHkdf = false;
  let hasAesGcm = false;

  for (const sf of sourceFiles) {
    const stringLiterals = sf
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((s) => s.getLiteralValue());

    if (stringLiterals.includes('X25519') || stringLiterals.includes('ECDH')) {
      hasAsymmetricKey = true;
    }
    if (stringLiterals.includes('HKDF')) {
      hasHkdf = true;
    }
    if (stringLiterals.includes('AES-GCM')) {
      hasAesGcm = true;
    }
  }

  return hasAsymmetricKey && hasHkdf && hasAesGcm;
}

function hasKemKeyPairGeneration(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  const validKemAlgorithms = ['MLKEM768-X25519', 'ML-KEM-768', 'ML-KEM-1024'];
  let hasValidKemAlgo = false;
  let hasKemUsages = false;

  for (const sf of sourceFiles) {
    const stringLiterals = sf
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((s) => s.getLiteralValue());

    if (validKemAlgorithms.some((algo) => stringLiterals.includes(algo))) {
      hasValidKemAlgo = true;
    }

    const arrayLiterals = sf.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression);
    for (const arr of arrayLiterals) {
      const elements = arr.getElements().map((e) => e.getText().replace(/['"`]/g, ''));
      if (
        (elements.includes('encapsulateKey') && elements.includes('decapsulateKey')) ||
        (elements.includes('encapsulateBits') && elements.includes('decapsulateBits'))
      ) {
        hasKemUsages = true;
      }
    }
  }

  return hasValidKemAlgo && hasKemUsages;
}

function hasEncapsulateAndDecapsulate(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let hasEncapsulate = false;
  let hasDecapsulate = false;

  for (const sf of sourceFiles) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression().getText();
      if (expr.endsWith('.encapsulateKey') || expr === 'encapsulateKey') {
        hasEncapsulate = true;
      }
      if (expr.endsWith('.decapsulateKey') || expr === 'decapsulateKey') {
        hasDecapsulate = true;
      }
    }
  }

  return hasEncapsulate && hasDecapsulate;
}

function hasModernRawFormats(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let hasModernRaw = false;

  for (const sf of sourceFiles) {
    const stringLiterals = sf
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((s) => s.getLiteralValue());

    if (
      stringLiterals.includes('raw-public') ||
      stringLiterals.includes('raw-seed') ||
      stringLiterals.includes('raw-secret')
    ) {
      hasModernRaw = true;
    }
  }

  return hasModernRaw;
}

function hasClassicalRawFormatFallback(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let hasClassicalRaw = false;

  for (const sf of sourceFiles) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression().getText();
      if (expr.endsWith('.exportKey') || expr.endsWith('.importKey')) {
        const args = call.getArguments().map((a) => a.getText().replace(/['"`]/g, ''));
        if (args.includes('raw')) {
          hasClassicalRaw = true;
        }
      }
    }
  }

  return hasClassicalRaw;
}

function hasAuthenticatedEncryption(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let hasAeadAlgo = false;
  let hasEncryptCall = false;

  for (const sf of sourceFiles) {
    const stringLiterals = sf
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((s) => s.getLiteralValue());

    if (stringLiterals.includes('ChaCha20-Poly1305') || stringLiterals.includes('AES-GCM')) {
      hasAeadAlgo = true;
    }

    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression().getText();
      if (expr.endsWith('.encrypt') || expr === 'encrypt') {
        hasEncryptCall = true;
      }
    }
  }

  return hasAeadAlgo && hasEncryptCall;
}

function hasFresh12ByteIv(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let has12ByteIv = false;

  for (const sf of sourceFiles) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression().getText();
      if (expr.endsWith('.getRandomValues') || expr === 'getRandomValues') {
        const args = call.getArguments();
        for (const arg of args) {
          const argText = arg.getText();
          if (/Uint8Array\s*\(\s*12\s*\)/.test(argText) || argText.includes('12')) {
            has12ByteIv = true;
          }
        }
      }
    }
  }

  return has12ByteIv;
}

function hasDecryptionWithSharedKey(project: Project): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let hasDecryptCall = false;

  for (const sf of sourceFiles) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression().getText();
      if (expr.endsWith('.decrypt') || expr === 'decrypt') {
        hasDecryptCall = true;
      }
    }
  }

  return hasDecryptCall;
}

function hasRecoveredPlaintextInUi(
  project: Project,
  docs: Array<{ file: string; document: Document }>
): boolean {
  const sourceFiles = getAppSourceFiles(project);
  if (sourceFiles.length === 0) return false;

  let hasDomTextUpdate = false;

  for (const sf of sourceFiles) {
    const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const be of binaryExprs) {
      if (be.getOperatorToken().getText() === '=') {
        const left = be.getLeft().getText();
        if (
          left.includes('textContent') ||
          left.includes('innerText') ||
          left.includes('value') ||
          left.includes('innerHTML')
        ) {
          hasDomTextUpdate = true;
        }
      }
    }
  }

  const hasUiMarkup = docs.some((d) => {
    const doc = d.document;
    return Boolean(
      doc.querySelector(
        '#secure-note, .private-message, #encrypt-btn, #encrypt-message, #out-plain, #recovered-message, [id*="encrypt"], [id*="decrypt"], [id*="cipher"], [id*="plain"], [class*="encrypt"], [class*="decrypt"], [data-encrypt], [data-decrypt]'
      )
    );
  });

  return hasDomTextUpdate && hasUiMarkup;
}

test.describe('Daily Grind Client-Side Encryption Grader', () => {
  test('SubtleCrypto.supports() static method is used to probe modern WebCrypto algorithm support', () => {
    const project = getJsProject(targetFiles);
    expect(hasSubtleCryptoSupports(project)).toBe(true);
  });

  test('Classical WebCrypto fallback is implemented using X25519 or ECDH with HKDF and AES-GCM', () => {
    const project = getJsProject(targetFiles);
    expect(hasClassicalWebCryptoFallback(project)).toBe(true);
  });

  test('KEM key pair is generated with encapsulateKey and decapsulateKey usages using modern algorithms', () => {
    const project = getJsProject(targetFiles);
    expect(hasKemKeyPairGeneration(project)).toBe(true);
  });

  test('Shared encryption key is established using crypto.subtle.encapsulateKey() and crypto.subtle.decapsulateKey()', () => {
    const project = getJsProject(targetFiles);
    expect(hasEncapsulateAndDecapsulate(project)).toBe(true);
  });

  test('Modern WebCrypto keys are exported or imported using explicit modern raw formats (raw-public, raw-seed, or raw-secret)', () => {
    const project = getJsProject(targetFiles);
    expect(hasModernRawFormats(project)).toBe(true);
  });

  test('Classical WebCrypto keys fall back to using raw format for export or import', () => {
    const project = getJsProject(targetFiles);
    expect(hasClassicalRawFormatFallback(project)).toBe(true);
  });

  test('Plaintext is encrypted using an authenticated encryption algorithm (ChaCha20-Poly1305 or AES-GCM)', () => {
    const project = getJsProject(targetFiles);
    expect(hasAuthenticatedEncryption(project)).toBe(true);
  });

  test('A fresh 12-byte initialization vector (iv) is generated using crypto.getRandomValues()', () => {
    const project = getJsProject(targetFiles);
    expect(hasFresh12ByteIv(project)).toBe(true);
  });

  test('Ciphertext is decrypted with crypto.subtle.decrypt() using the established shared key', () => {
    const project = getJsProject(targetFiles);
    expect(hasDecryptionWithSharedKey(project)).toBe(true);
  });

  test('Decrypted plaintext is recovered and rendered into the UI', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles) as Array<{ file: string; document: Document }>;
    expect(hasRecoveredPlaintextInUi(project, docs)).toBe(true);
  });
});
