import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('digital-signatures Target Grader', () => {
  // Requirement 1: Checks for modern WebCrypto signature algorithm support using static SubtleCrypto.supports()
  test('checks for modern WebCrypto signature algorithm support using static SubtleCrypto.supports()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasSupportsCheck = sourceFiles.some((sf) => {
      const hasSubtleCrypto = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => id.getText() === 'SubtleCrypto');
      const callsSupports = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => call.getExpression().getText().includes('supports'));
      const accessesSupports = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((pa) => pa.getName() === 'supports');
      return hasSubtleCrypto && (callsSupports || accessesSupports);
    });
    expect(hasSupportsCheck).toBe(true);
  });

  // Requirement 1: Falls back to a classical signature algorithm (Ed25519 or ECDSA) when unsupported
  test('falls back to a classical signature algorithm (Ed25519 or ECDSA) when modern algorithms are unsupported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasClassicalFallback = sourceFiles.some((sf) => {
      const literals = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
      ];
      return literals.some((lit) => {
        const val = lit.getLiteralValue();
        return val === 'Ed25519' || val === 'ECDSA';
      });
    });
    expect(hasClassicalFallback).toBe(true);
  });

  // Requirement 2: Generates a key pair for ML-DSA-44, ML-DSA-65, or ML-DSA-87
  test('generates a key pair for an ML-DSA algorithm (ML-DSA-44, ML-DSA-65, or ML-DSA-87)', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasMlDsaGeneration = sourceFiles.some((sf) => {
      const callsGenerateKey = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => call.getExpression().getText().includes('generateKey'));
      const hasMlDsa = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
      ].some((lit) => /^ML-DSA-(44|65|87)$/.test(lit.getLiteralValue()));
      return callsGenerateKey && hasMlDsa;
    });
    expect(hasMlDsaGeneration).toBe(true);
  });

  // Requirement 2: Key pair generation specifies ['sign', 'verify'] usages
  test('specifies sign and verify key usages during key pair generation', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasSignVerifyUsages = sourceFiles.some((sf) => {
      return sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          if (!call.getExpression().getText().includes('generateKey')) return false;
          return call.getArguments().some((arg) => {
            if (arg.getKind() === SyntaxKind.ArrayLiteralExpression) {
              const elements = (arg as any)
                .getElements()
                .map((el: any) => el.getText().replace(/['"`]/g, ''));
              return elements.includes('sign') && elements.includes('verify');
            }
            return false;
          });
        });
    });
    expect(hasSignVerifyUsages).toBe(true);
  });

  // Requirement 3: Exports or imports verification key using modern raw formats ('raw-public' or 'raw-seed')
  test('exports or imports ML-DSA keys using explicit modern raw formats (raw-public or raw-seed)', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasModernRawFormat = sourceFiles.some((sf) => {
      return sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          const expr = call.getExpression().getText();
          if (!expr.includes('exportKey') && !expr.includes('importKey')) return false;
          return call.getArguments().some((arg) => {
            const text = arg.getText().replace(/['"`]/g, '');
            return text === 'raw-public' || text === 'raw-seed';
          });
        });
    });
    expect(hasModernRawFormat).toBe(true);
  });

  // Requirement 3: Falls back to 'raw' format for classical keys rather than passing 'raw' to ML-DSA
  test('falls back to the raw format for classical keys rather than passing raw to ML-DSA', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasClassicalRawFormat = sourceFiles.some((sf) => {
      return sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          const expr = call.getExpression().getText();
          if (!expr.includes('exportKey') && !expr.includes('importKey')) return false;
          return call.getArguments().some((arg) => {
            const text = arg.getText().replace(/['"`]/g, '');
            return text === 'raw';
          });
        });
    });
    expect(hasClassicalRawFormat).toBe(true);
  });

  // Requirement 4: Signs payload data using crypto.subtle.sign()
  test('signs payload data using crypto.subtle.sign()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasSubtleSign = sourceFiles.some((sf) => {
      return sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          const expr = call.getExpression().getText();
          return (
            expr.includes('sign') &&
            (expr.includes('subtle') || expr.includes('api') || expr.endsWith('.sign'))
          );
        });
    });
    expect(hasSubtleSign).toBe(true);
  });

  // Requirement 4: Configures domain-separation context parameter for ML-DSA
  test('configures domain-separation context for ML-DSA signing and verification', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasDomainContext = sourceFiles.some((sf) => {
      const hasPropertyAssignment = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .some((pa) => pa.getName() === 'context');
      const hasShorthand = sf
        .getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)
        .some((spa) => spa.getName() === 'context');
      return hasPropertyAssignment || hasShorthand;
    });
    expect(hasDomainContext).toBe(true);
  });

  // Requirement 4: Produces non-empty signature displayed in UI
  test('renders an element in the UI to display the generated digital signature', () => {
    const docs = getHtmlDocuments(targetFiles);
    const sigEl = docs
      .map((d) => d.document.querySelector('[id*="signature"]'))
      .find(Boolean);
    expect(Boolean(sigEl)).toBe(true);
  });

  // Requirement 5: Verifies signature against payload using crypto.subtle.verify()
  test('verifies the digital signature using crypto.subtle.verify()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasSubtleVerify = sourceFiles.some((sf) => {
      return sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          const expr = call.getExpression().getText();
          return (
            expr.includes('verify') &&
            (expr.includes('subtle') || expr.includes('api') || expr.endsWith('.verify'))
          );
        });
    });
    expect(hasSubtleVerify).toBe(true);
  });

  // Requirement 5: Displays verification status in the UI
  test('displays the signature verification status in the UI', () => {
    const docs = getHtmlDocuments(targetFiles);
    const statusEl = docs
      .map((d) => d.document.querySelector('[id*="status"], [role="status"]'))
      .find(Boolean);
    expect(Boolean(statusEl)).toBe(true);
  });
});
