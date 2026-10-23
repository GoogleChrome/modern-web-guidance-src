import fs from 'node:fs';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, Node, type Project } from 'ts-morph';
import { parseHTML, type Document } from 'linkedom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

// Initialize project and documents across all target files
const project: Project = getJsProject(targetFiles);

// Ensure .mjs / .cjs files from targetFiles are loaded into the ts-morph project
for (const file of targetFiles) {
  if (/\.(mjs|cjs)$/i.test(file) && fs.existsSync(file)) {
    project.createSourceFile(file, fs.readFileSync(file, 'utf8'), { overwrite: true });
  }
}

// Helper: Collect HTML documents from standalone files and template strings in JS/TS
function collectHtmlDocuments(): Array<{ file: string; document: Document }> {
  const docs = getHtmlDocuments(targetFiles);

  for (const sf of project.getSourceFiles()) {
    const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
    const templateLiterals = sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral);
    const templateHeads = sf.getDescendantsOfKind(SyntaxKind.TemplateHead);
    const templateExprs = sf.getDescendantsOfKind(SyntaxKind.TemplateExpression);

    const candidateTexts = [
      ...stringLiterals.map((l) => l.getLiteralText()),
      ...templateLiterals.map((l) => l.getLiteralText()),
      ...templateHeads.map((l) => l.getLiteralText()),
      ...templateExprs.map((l) => l.getText()),
    ];

    for (const text of candidateTexts) {
      if (text.includes('<form') && (text.includes('autocomplete=') || text.includes('token'))) {
        try {
          const { document } = parseHTML(text);
          docs.push({ file: sf.getFilePath(), document });
        } catch {
          // Ignore parse errors in non-HTML snippets
        }
      }
    }
  }

  return docs;
}

test.describe('verify-email-ownership Target Grader', () => {

  // --- REQUIREMENT 1: Verification Form HTML Structure ---

  test('Expectation 1: Form includes email input with autocomplete="email"', () => {
    const docs = collectHtmlDocuments();
    let hasEmailInput = false;

    for (const { document } of docs) {
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        const inputs = Array.from(form.querySelectorAll('input'));
        const emailInput = inputs.find((i) =>
          (i.getAttribute('type') || '').toLowerCase() === 'email' &&
          (i.getAttribute('autocomplete') || '').toLowerCase() === 'email'
        );
        if (emailInput) {
          hasEmailInput = true;
          break;
        }
      }
      if (hasEmailInput) break;
    }

    expect(hasEmailInput).toBe(true);
  });

  test('Expectation 1: Form includes hidden verification token input with autocomplete="email-verification-token"', () => {
    const docs = collectHtmlDocuments();
    let hasHiddenTokenInput = false;

    for (const { document } of docs) {
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        const inputs = Array.from(form.querySelectorAll('input'));
        const emailInput = inputs.find((i) =>
          (i.getAttribute('type') || '').toLowerCase() === 'email' &&
          (i.getAttribute('autocomplete') || '').toLowerCase() === 'email'
        );
        const tokenInput = inputs.find((i) =>
          (i.getAttribute('type') || '').toLowerCase() === 'hidden' &&
          (i.getAttribute('autocomplete') || '').toLowerCase() === 'email-verification-token'
        );

        if (emailInput && tokenInput) {
          hasHiddenTokenInput = true;
          break;
        }
      }
      if (hasHiddenTokenInput) break;
    }

    expect(hasHiddenTokenInput).toBe(true);
  });

  test('Expectation 1: Hidden verification token input has non-empty nonce attribute', () => {
    const docs = collectHtmlDocuments();
    let hasNonEmptyNonce = false;

    for (const { document } of docs) {
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        const inputs = Array.from(form.querySelectorAll('input'));
        const tokenInput = inputs.find((i) =>
          (i.getAttribute('type') || '').toLowerCase() === 'hidden' &&
          (i.getAttribute('autocomplete') || '').toLowerCase() === 'email-verification-token'
        );

        if (tokenInput) {
          const nonceValue = (tokenInput.getAttribute('nonce') || '').trim();
          if (nonceValue.length > 0) {
            hasNonEmptyNonce = true;
            break;
          }
        }
      }
      if (hasNonEmptyNonce) break;
    }

    expect(hasNonEmptyNonce).toBe(true);
  });

  // --- REQUIREMENT 2: Nonce Generation, Session Storage, Cache-Control ---

  test('Expectation 2: Server generates cryptographic nonce with at least 128 bits of entropy', () => {
    let generatesCryptoNonce = false;

    for (const sf of project.getSourceFiles()) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        const exprText = call.getExpression().getText();
        if (
          exprText.includes('randomBytes') ||
          exprText.includes('getRandomValues') ||
          exprText.includes('randomUUID')
        ) {
          const args = call.getArguments();
          if (args.length > 0) {
            const firstArg = args[0];
            if (firstArg.isKind(SyntaxKind.NumericLiteral)) {
              if (firstArg.getLiteralValue() >= 16) {
                generatesCryptoNonce = true;
              }
            } else {
              generatesCryptoNonce = true;
            }
          } else {
            generatesCryptoNonce = true;
          }
        }
      }
    }

    expect(generatesCryptoNonce).toBe(true);
  });

  test('Expectation 2: Server stores nonce in server-side session state rather than directly in client cookie', () => {
    let storesNonceInSession = false;

    for (const sf of project.getSourceFiles()) {
      const hasSessionState =
        sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((pa) =>
          pa.getText().includes('.nonce') || pa.getText().includes('session')
        ) ||
        sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration).some((cd) =>
          (cd.getName() || '').toLowerCase().includes('session')
        ) ||
        sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((vd) =>
          vd.getName().toLowerCase().includes('session')
        );

      const setsCookie = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some((sl) =>
        /Set-Cookie/i.test(sl.getLiteralText())
      );

      if (hasSessionState && setsCookie) {
        storesNonceInSession = true;
        break;
      }
    }

    expect(storesNonceInSession).toBe(true);
  });

  test('Expectation 2: Server serves form page with Cache-Control: no-store', () => {
    let servesNoStore = false;

    for (const sf of project.getSourceFiles()) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        const exprText = call.getExpression().getText();
        if (
          exprText.includes('setHeader') ||
          exprText.includes('writeHead') ||
          exprText.includes('header')
        ) {
          const argTexts = call.getArguments().map((a) => a.getText());
          if (argTexts.some((a) => a.includes('Cache-Control') && a.includes('no-store'))) {
            servesNoStore = true;
          }
        }
      }

      const propAssignments = sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment);
      for (const pa of propAssignments) {
        const name = pa.getName();
        if (/cache-control/i.test(name) && pa.getInitializer()?.getText().includes('no-store')) {
          servesNoStore = true;
        }
      }
    }

    expect(servesNoStore).toBe(true);
  });

  // --- REQUIREMENT 3: Cryptographic Token Validation Strictly on Server ---

  test('Expectation 3: Cryptographic token validation is executed strictly on the server and not in client scripts', () => {
    const rawHtmlDocs = getHtmlDocuments(targetFiles);
    const hasClientValidation = rawHtmlDocs.some(({ document }) => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some((s: any) => {
        const text = s?.textContent || '';
        return (
          text.includes('jwtVerify') ||
          text.includes('@sd-jwt') ||
          text.includes('jose') ||
          text.includes('verifyEmailVerificationToken')
        );
      });
    });

    let hasServerVerification = false;
    for (const sf of project.getSourceFiles()) {
      const imports = sf.getImportDeclarations();
      if (
        imports.some((i) =>
          i.getModuleSpecifierValue().includes('@sd-jwt') ||
          i.getModuleSpecifierValue() === 'jose'
        )
      ) {
        hasServerVerification = true;
        break;
      }
    }

    const strictlyServerValidation = hasServerVerification && !hasClientValidation;
    expect(strictlyServerValidation).toBe(true);
  });

  // --- REQUIREMENT 4: Established SD-JWT and JOSE Libraries ---

  test('Expectation 4: Server verification uses established platform SD-JWT and JOSE libraries', () => {
    let hasSdJwtImport = false;
    let hasJoseImport = false;

    for (const sf of project.getSourceFiles()) {
      for (const imp of sf.getImportDeclarations()) {
        const mod = imp.getModuleSpecifierValue();
        if (mod.includes('@sd-jwt')) hasSdJwtImport = true;
        if (mod === 'jose') hasJoseImport = true;
      }
    }

    const usesSdJwtAndJoseLibraries = hasSdJwtImport && hasJoseImport;
    expect(usesSdJwtAndJoseLibraries).toBe(true);
  });

  // --- REQUIREMENT 5: Atomic Nonce Consumption & Case-Insensitive Email Comparison ---

  test('Expectation 5: Server atomically reads and deletes expected nonce from session storage on receipt', () => {
    let atomicallyConsumesNonce = false;

    for (const sf of project.getSourceFiles()) {
      const deleteExprs = sf.getDescendantsOfKind(SyntaxKind.DeleteExpression);
      for (const de of deleteExprs) {
        if (de.getExpression().getText().includes('nonce')) {
          atomicallyConsumesNonce = true;
          break;
        }
      }

      const funcNames = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).map((f) => f.getName() || ''),
        ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration).map((m) => m.getName() || ''),
      ];
      if (funcNames.some((fn) => /consume.*nonce/i.test(fn))) {
        atomicallyConsumesNonce = true;
      }

      if (atomicallyConsumesNonce) break;
    }

    expect(atomicallyConsumesNonce).toBe(true);
  });

  test('Expectation 5: Server verifies token email claim matches submitted email case-insensitively', () => {
    let comparesEmailCaseInsensitively = false;

    for (const sf of project.getSourceFiles()) {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const toLowerCalls = calls.filter((c) => {
        const expr = c.getExpression();
        return expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'toLowerCase';
      });

      for (const call of toLowerCalls) {
        const expr = call.getExpression();
        if (Node.isPropertyAccessExpression(expr)) {
          const callerText = expr.getExpression().getText().toLowerCase();
          if (callerText.includes('email')) {
            comparesEmailCaseInsensitively = true;
            break;
          }
        }
      }

      if (comparesEmailCaseInsensitively) break;
    }

    expect(comparesEmailCaseInsensitively).toBe(true);
  });

  // --- REQUIREMENT 6: DNS TXT Delegation & Issuer Discovery ---

  test('Expectation 6: Server validates DNS TXT delegation at _email-verification.<domain> matching iss origin', () => {
    let validatesDnsTxtDelegation = false;

    for (const sf of project.getSourceFiles()) {
      const candidateTexts = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map((l) => l.getLiteralText()),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((l) => l.getLiteralText()),
        ...sf.getDescendantsOfKind(SyntaxKind.TemplateHead).map((l) => l.getLiteralText()),
        ...sf.getDescendantsOfKind(SyntaxKind.TemplateExpression).map((l) => l.getText()),
      ];

      const hasDnsTxtRecord = candidateTexts.some((t) => t.includes('_email-verification.'));
      const hasIssPrefix = candidateTexts.some((t) => t.includes('iss='));

      if (hasDnsTxtRecord && hasIssPrefix) {
        validatesDnsTxtDelegation = true;
        break;
      }
    }

    expect(validatesDnsTxtDelegation).toBe(true);
  });

  test('Expectation 6: Server verifies metadata.issuer === iss in .well-known/email-verification discovery response', () => {
    let verifiesDiscoveryIssuer = false;

    for (const sf of project.getSourceFiles()) {
      const stringLiterals = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map((l) => l.getLiteralText()),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((l) => l.getLiteralText()),
      ];
      const hasDiscoveryUrl = stringLiterals.some((t) => t.includes('/.well-known/email-verification'));
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const accessesMetadataIssuer = propAccesses.some((pa) =>
        pa.getName() === 'issuer' && pa.getExpression().getText().toLowerCase().includes('metadata')
      );

      if (hasDiscoveryUrl && accessesMetadataIssuer) {
        verifiesDiscoveryIssuer = true;
        break;
      }
    }

    expect(verifiesDiscoveryIssuer).toBe(true);
  });

  // --- REQUIREMENT 7: Missing kid Handling in JWKS Verification ---

  test('Expectation 7: Server iterates through all keys in JWKS when kid is omitted in token header', () => {
    let iteratesJwksWhenKidOmitted = false;

    for (const sf of project.getSourceFiles()) {
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      const handlesMultipleKeys = identifiers.some((id) =>
        id.getText().includes('JWKSMultipleMatchingKeys') ||
        id.getText().includes('ERR_JWKS_MULTIPLE_MATCHING_KEYS')
      );
      const stringLits = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
      const handlesMultipleKeysStr = stringLits.some((sl) =>
        sl.getLiteralText().includes('ERR_JWKS_MULTIPLE_MATCHING_KEYS')
      );
      const hasLoop = sf.getDescendantsOfKind(SyntaxKind.ForOfStatement).length > 0;

      if ((handlesMultipleKeys || handlesMultipleKeysStr) && hasLoop) {
        iteratesJwksWhenKidOmitted = true;
        break;
      }
    }

    expect(iteratesJwksWhenKidOmitted).toBe(true);
  });

  // --- REQUIREMENT 8: Rejection of Missing/Mismatched KB-JWT Claims and Algorithm ---

  test('Expectation 8: Server rejects presentation when KB-JWT is missing or binding claims and algorithm mismatch', () => {
    let validatesKeyBindingJwt = false;

    for (const sf of project.getSourceFiles()) {
      const propAssignments = sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment);
      const hasKeyBindingNonce = propAssignments.some((pa) =>
        pa.getName().toLowerCase().includes('keybindingnonce') || pa.getName() === 'kbVerifier'
      );
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      const accessesKbJwt = propAccesses.some((pa) => pa.getName() === 'kbJwt');
      const accessesCnfJwk = propAccesses.some((pa) =>
        pa.getText().includes('cnf') || pa.getText().includes('holderJwk')
      );

      if ((hasKeyBindingNonce || accessesKbJwt) && accessesCnfJwk) {
        validatesKeyBindingJwt = true;
        break;
      }
    }

    expect(validatesKeyBindingJwt).toBe(true);
  });

  // --- REQUIREMENT 9: Graceful Fallback Flow ---

  test('Expectation 9: Server falls back gracefully to email OTP or magic link verification flow on failure or missing token', () => {
    let handlesVerificationFallback = false;

    for (const sf of project.getSourceFiles()) {
      const catchClauses = sf.getDescendantsOfKind(SyntaxKind.CatchClause);
      const hasCatchFallback = catchClauses.some((cc) => {
        const parentTry = cc.getParent();
        const tryText = parentTry ? parentTry.getText() : '';
        return tryText.includes('verify') || tryText.includes('Token');
      });

      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasFallbackCall = calls.some((c) => {
        const name = c.getExpression().getText().toLowerCase();
        return (
          name.includes('send') ||
          name.includes('mail') ||
          name.includes('otp') ||
          name.includes('challenge') ||
          name.includes('traditional')
        );
      });

      if (hasCatchFallback && hasFallbackCall) {
        handlesVerificationFallback = true;
        break;
      }
    }

    expect(handlesVerificationFallback).toBe(true);
  });
});
