import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { Node, SyntaxKind, type SourceFile } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAppSourceFiles(files: string[]): SourceFile[] {
  return getJsProject(files)
    .getSourceFiles()
    .filter(
      (sf) =>
        !/(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(
          sf.getFilePath(),
        ),
    );
}

function getEnclosingFunctionName(paramNode: Node): string | undefined {
  const fn = paramNode.getParent();
  if (!fn) return undefined;
  if (Node.isFunctionDeclaration(fn) || Node.isMethodDeclaration(fn)) {
    return fn.getName();
  }
  if (Node.isArrowFunction(fn) || Node.isFunctionExpression(fn)) {
    const parent = fn.getParent();
    if (Node.isVariableDeclaration(parent)) return parent.getName();
    if (Node.isPropertyAssignment(parent)) return parent.getName();
  }
  return undefined;
}

function resolveArgumentStrings(
  node: Node | undefined,
  sf: SourceFile,
  visited = new Set<Node>(),
): string[] {
  if (!node || visited.has(node)) return [];
  visited.add(node);

  if (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isTypeAssertion(node) ||
    Node.isSatisfiesExpression(node)
  ) {
    return resolveArgumentStrings(node.getExpression(), sf, visited);
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return [node.getLiteralValue()];
  }
  if (Node.isConditionalExpression(node)) {
    return [
      ...resolveArgumentStrings(node.getWhenTrue(), sf, visited),
      ...resolveArgumentStrings(node.getWhenFalse(), sf, visited),
    ];
  }
  if (Node.isObjectLiteralExpression(node)) {
    return node
      .getProperties()
      .flatMap((prop) =>
        Node.isPropertyAssignment(prop)
          ? resolveArgumentStrings(prop.getInitializer(), sf, visited)
          : [],
      );
  }
  if (Node.isPropertyAccessExpression(node)) {
    const propName = node.getName();
    const fromMatchingProps = sf
      .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .filter((pa) => pa.getName() === propName)
      .flatMap((pa) => resolveArgumentStrings(pa.getInitializer(), sf, visited));
    return [...fromMatchingProps, ...resolveArgumentStrings(node.getExpression(), sf, visited)];
  }
  if (Node.isElementAccessExpression(node)) {
    return resolveArgumentStrings(node.getExpression(), sf, visited);
  }
  if (Node.isIdentifier(node)) {
    const name = node.getText();
    const out: string[] = [];
    for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      if (vd.getName() === name) {
        out.push(...resolveArgumentStrings(vd.getInitializer(), sf, visited));
      }
    }
    for (const bin of sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (
        bin.getOperatorToken().getText() === '=' &&
        bin.getLeft().getText() === name
      ) {
        out.push(...resolveArgumentStrings(bin.getRight(), sf, visited));
      }
    }
    for (const param of sf.getDescendantsOfKind(SyntaxKind.Parameter)) {
      if (param.getName() !== name) continue;
      if (param.getInitializer()) {
        out.push(...resolveArgumentStrings(param.getInitializer(), sf, visited));
      }
      const fnParent = param.getParent();
      const paramIndex = Node.isFunctionLikeDeclaration(fnParent)
        ? fnParent.getParameters().indexOf(param)
        : -1;
      const fnName = getEnclosingFunctionName(param);
      if (fnName && paramIndex >= 0) {
        for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
          const callee = call.getExpression().getText();
          if (callee === fnName || callee.endsWith(`.${fnName}`)) {
            out.push(...resolveArgumentStrings(call.getArguments()[paramIndex], sf, visited));
          }
        }
      }
    }
    return out;
  }
  return [];
}

function getExportImportFormatValues(files: string[]): Set<string> {
  const formats = new Set<string>();
  for (const sf of getAppSourceFiles(files)) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression().getText();
      if (!expr.includes('exportKey') && !expr.includes('importKey')) continue;
      const formatArg = call.getArguments()[0];
      for (const value of resolveArgumentStrings(formatArg, sf)) {
        formats.add(value);
      }
    }
  }
  return formats;
}

test.describe('digital-signatures Target Grader', () => {
  // Requirement 1: Checks for modern WebCrypto signature algorithm support using static SubtleCrypto.supports()
  test('checks for modern WebCrypto signature algorithm support using static SubtleCrypto.supports()', () => {
    const sourceFiles = getAppSourceFiles(targetFiles);
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
    const sourceFiles = getAppSourceFiles(targetFiles);
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
    const sourceFiles = getAppSourceFiles(targetFiles);
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
    const sourceFiles = getAppSourceFiles(targetFiles);
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
    const formats = getExportImportFormatValues(targetFiles);
    expect(formats.has('raw-public') || formats.has('raw-seed')).toBe(true);
  });

  // Requirement 3: Falls back to 'raw' format for classical keys rather than passing 'raw' to ML-DSA
  test('falls back to the raw format for classical keys rather than passing raw to ML-DSA', () => {
    const formats = getExportImportFormatValues(targetFiles);
    expect(formats.has('raw')).toBe(true);
  });

  // Requirement 4: Signs payload data using crypto.subtle.sign()
  test('signs payload data using crypto.subtle.sign()', () => {
    const sourceFiles = getAppSourceFiles(targetFiles);
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
    const sourceFiles = getAppSourceFiles(targetFiles);
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
      .map((d) =>
        d.document.querySelector(
          '[id*="signature" i], [id*="sig-" i], [id*="token" i], [data-signature], textarea[readonly], [id*="sign" i] textarea, [id*="sign" i] code, [id*="sign" i] pre, [class*="sign" i] textarea, [class*="sign" i] code, [class*="sign" i] pre',
        ),
      )
      .find(Boolean);
    expect(Boolean(sigEl)).toBe(true);
  });

  // Requirement 5: Verifies signature against payload using crypto.subtle.verify()
  test('verifies the digital signature using crypto.subtle.verify()', () => {
    const sourceFiles = getAppSourceFiles(targetFiles);
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
      .map((d) =>
        d.document.querySelector(
          '[id*="status" i], [id*="verdict" i], [role="status"], [aria-live], output',
        ),
      )
      .find(Boolean);
    expect(Boolean(statusEl)).toBe(true);
  });
});
