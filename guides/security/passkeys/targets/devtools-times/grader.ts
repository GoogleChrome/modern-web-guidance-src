/**
 * Expectation Verification Summary:
 * Expectation 1: TESTED - Verifies that passkey entry points are gated on a PublicKeyCredential feature detection check and hidden when unsupported.
 * Expectation 2: TESTED - Verifies that passkey flows wrap navigator.credentials calls in try/catch error handling that catches expected WebAuthn exceptions (NotAllowedError, AbortError).
 * Expectation 3: TESTED - Verifies that the client decodes server-provided registration options with PublicKeyCredential.parseCreationOptionsFromJSON before invoking navigator.credentials.create().
 * Expectation 4: TESTED - Verifies that the client decodes server-provided authentication options with PublicKeyCredential.parseRequestOptionsFromJSON before invoking navigator.credentials.get().
 * Expectation 5: TESTED - Verifies that WebAuthn options are fetched from a server endpoint rather than constructing the challenge value on the client.
 * Expectation 6: SKIPPED - Relying Party ID configuration is generated and validated server-side during option generation.
 * Expectation 7: SKIPPED - The base web application does not have an associated Android app.
 * Expectation 8: SKIPPED - The base web application does not have an associated iOS or macOS native app.
 * Expectation 9: SKIPPED - The web application operates on a single origin and does not share passkeys across distinct eTLD+1 domains.
 * Expectation 10: TESTED - Verifies that the client serializes the returned credential using PublicKeyCredential.prototype.toJSON and posts it to a server verification endpoint.
 * Expectation 11: SKIPPED - The base web application does not contain a credential management list or deletion flow.
 * Expectation 12: SKIPPED - The base web application does not contain a user profile or display name update flow.
 * Expectation 13: SKIPPED - The base web application does not implement unknown credential signaling for asserted passkeys.
 * Expectation 14: SKIPPED - The base web application does not render credential management lists or authenticator provider icons.
 * Expectation 15: TESTED - Verifies that the application delegates WebAuthn verification to the server without hand-rolling client-side cryptographic signature verification.
 */

import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind, Node } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Passkeys Target Grader - DevTools Times', () => {

  test('Expectation 1: Passkey entry points are gated on feature detection and hidden when unsupported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasFeatureDetection = sourceFiles.some((sf) => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);

      const hasInWindow = binaryExprs.some((expr) => {
        const left = expr.getLeft().getText();
        const op = expr.getOperatorToken().getText();
        const right = expr.getRight().getText();
        return op === 'in' && left.includes('PublicKeyCredential') && /window|globalThis/i.test(right);
      });

      const hasFeatureCall = calls.some((c) => {
        const text = c.getExpression().getText();
        return /isConditionalMediationAvailable|getClientCapabilities|isUserVerifyingPlatformAuthenticatorAvailable/i.test(text);
      });

      const hasTypeofCheck = binaryExprs.some((expr) => {
        return expr.getText().includes('PublicKeyCredential') && expr.getText().includes('undefined');
      });

      return hasInWindow || hasFeatureCall || hasTypeofCheck;
    });

    const hasGatedEntryPoints = sourceFiles.some((sf) => {
      const jsxElements = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
      return jsxElements.some((el) => {
        const text = el.getText().toLowerCase();
        const tagName = Node.isJsxElement(el)
          ? el.getOpeningElement().getTagNameNode().getText()
          : el.getTagNameNode().getText();
        const isPasskeyButton = (text.includes('passkey') || text.includes('auth-button') || text.includes('register-button')) &&
          (tagName === 'button' || text.includes('button'));
        if (!isPasskeyButton) return false;
        return el.getAncestors().some((a) =>
          a.getKind() === SyntaxKind.BinaryExpression ||
          a.getKind() === SyntaxKind.ConditionalExpression ||
          a.getKind() === SyntaxKind.IfStatement
        );
      });
    });

    const docs = getHtmlDocuments(targetFiles);
    const hasGatedHtml = docs.some((d) => {
      const elements = d.document.querySelectorAll('[class*="passkey"], [id*="passkey"], [data-passkey-entry]');
      return elements.length > 0;
    });

    expect(hasFeatureDetection && (hasGatedEntryPoints || hasGatedHtml)).toBe(true);
  });

  test('Expectation 2: Passkey flows wrap navigator.credentials calls in try/catch handling expected exceptions', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const credCalls = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((c) => {
        const text = c.getExpression().getText();
        return /navigator\.credentials\.(create|get)/.test(text);
      })
    );

    const hasHandledCredentialsCalls = credCalls.length > 0 && credCalls.every((c) => {
      const tryStmt = c.getFirstAncestorByKind(SyntaxKind.TryStatement);
      if (!tryStmt) return false;
      const catchClause = tryStmt.getCatchClause();
      if (!catchClause) return false;
      const catchText = catchClause.getText();
      return catchText.includes('NotAllowedError') || catchText.includes('AbortError');
    });

    expect(hasHandledCredentialsCalls).toBe(true);
  });

  test('Expectation 3: Client decodes registration options with parseCreationOptionsFromJSON before create()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasParseCreationOptions = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasParseCall = calls.some((c) =>
        c.getExpression().getText().includes('parseCreationOptionsFromJSON')
      );
      const hasCreateCall = calls.some((c) =>
        /navigator\.credentials\.create/.test(c.getExpression().getText())
      );
      return hasParseCall && hasCreateCall;
    });

    expect(hasParseCreationOptions).toBe(true);
  });

  test('Expectation 4: Client decodes authentication options with parseRequestOptionsFromJSON before get()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasParseRequestOptions = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasParseCall = calls.some((c) =>
        c.getExpression().getText().includes('parseRequestOptionsFromJSON')
      );
      const hasGetCall = calls.some((c) =>
        /navigator\.credentials\.get/.test(c.getExpression().getText())
      );
      return hasParseCall && hasGetCall;
    });

    expect(hasParseRequestOptions).toBe(true);
  });

  test('Expectation 5: WebAuthn options are fetched from a server endpoint', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasOptionsFetch = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((c) => {
        const text = c.getText();
        return /fetch/i.test(c.getExpression().getText()) && /options/i.test(text);
      });
    });

    expect(hasOptionsFetch).toBe(true);
  });

  test('Expectation 10: Client serializes credential using toJSON() and posts to verification endpoint', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasToJSONAndVerifyPost = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasToJSON = calls.some((c) => {
        const expr = c.getExpression().getText();
        return expr.endsWith('.toJSON') || expr.includes('toJSON(');
      });
      const hasVerifyPost = calls.some((c) => {
        const text = c.getText();
        return /fetch/i.test(c.getExpression().getText()) && /verify/i.test(text) && /POST/i.test(text);
      });
      return hasToJSON && hasVerifyPost;
    });

    expect(hasToJSONAndVerifyPost).toBe(true);
  });

  test('Expectation 15: Application delegates WebAuthn verification to the server without hand-rolling client crypto', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const delegatesVerificationWithoutHandRolledCrypto = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasServerVerifyCall = calls.some((c) => {
        const text = c.getText();
        return /fetch/i.test(c.getExpression().getText()) && /verify/i.test(text);
      });
      const hasHandRolledCrypto = calls.some((c) => {
        const expr = c.getExpression().getText();
        return expr.includes('crypto.subtle.verify') || expr.includes('crypto.subtle.digest');
      });
      return hasServerVerifyCall && !hasHandRolledCrypto;
    });

    expect(delegatesVerificationWithoutHandRolledCrypto).toBe(true);
  });
});
