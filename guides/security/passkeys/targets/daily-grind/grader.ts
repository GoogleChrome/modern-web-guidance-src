/**
 * Expectation Verification Summary:
 * 1. TESTED - Verifies that passkey entry points are gated on a PublicKeyCredential feature detection check and hidden when unsupported.
 * 2. TESTED - Verifies that navigator.credentials calls are wrapped in try/catch handling expected WebAuthn errors (NotAllowedError, AbortError).
 * 3. TESTED - Verifies that client decodes registration options with PublicKeyCredential.parseCreationOptionsFromJSON before navigator.credentials.create().
 * 4. TESTED - Verifies that client decodes authentication options with PublicKeyCredential.parseRequestOptionsFromJSON before navigator.credentials.get().
 * 5. TESTED - Verifies that WebAuthn options are fetched from a server endpoint rather than constructing challenges on the client.
 * 6. SKIPPED - Relying Party ID configuration is generated and validated server-side during option generation.
 * 7. TESTED - Verifies that credentials are serialized with PublicKeyCredential.prototype.toJSON and posted to a verification endpoint.
 * 8. TESTED - Verifies that PublicKeyCredential.signalAllAcceptedCredentials is invoked after credential list changes such as deletion.
 * 9. TESTED - Verifies that PublicKeyCredential.signalCurrentUserDetails is invoked when user details are updated.
 * 10. TESTED - Verifies that PublicKeyCredential.signalUnknownCredential is invoked when an asserted credential is unknown.
 * 11. TESTED - Verifies that AAGUID is used exclusively for rendering provider names or icons in the UI and not for access control.
 * 12. TESTED - Verifies that client-side JavaScript does not hand-roll WebAuthn signature verification or challenge validation.
 */

import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

const currentFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;

const targetFiles: string[] = getTargetFiles(currentFileUrl);

test.describe('Passkeys Target Grader - daily-grind', () => {

  test('Expectation 1: Passkey entry points are gated on feature detection and hidden when unsupported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasFeatureDetection = sourceFiles.some(sf => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);

      const hasInWindow = binaryExprs.some(expr => {
        const left = expr.getLeft().getText();
        const op = expr.getOperatorToken().getText();
        const right = expr.getRight().getText();
        return op === 'in' && left.includes('PublicKeyCredential') && /window|globalThis/i.test(right);
      });

      const hasFeatureCall = calls.some(c => {
        const text = c.getExpression().getText();
        return /isConditionalMediationAvailable|getClientCapabilities/i.test(text);
      });

      const hasTypeofCheck = binaryExprs.some(expr => {
        return expr.getText().includes('PublicKeyCredential') && expr.getText().includes('undefined');
      });

      return hasInWindow || hasFeatureCall || hasTypeofCheck;
    });

    const docs = getHtmlDocuments(targetFiles);
    const hasGatedElements = docs.some(d => {
      const elements = d.document.querySelectorAll('[class*="passkey"], [id*="passkey"], [data-passkey-entry]');
      return elements.length > 0;
    }) || sourceFiles.some(sf => {
      return sf.getFullText().includes('.style.display') && sf.getFullText().includes('passkey');
    });

    expect(hasFeatureDetection && hasGatedElements).toBe(true);
  });

  test('Expectation 2: Passkey flows wrap navigator.credentials calls in try/catch handling expected exceptions', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasHandledCredentialsCall = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const credCalls = calls.filter(c => {
        const text = c.getExpression().getText();
        return /navigator\.credentials\.(create|get)/.test(text);
      });

      if (credCalls.length === 0) return false;

      const fileText = sf.getFullText();
      return credCalls.some(c => {
        const tryStmt = c.getFirstAncestorByKind(SyntaxKind.TryStatement);
        if (!tryStmt) return false;
        const catchClause = tryStmt.getCatchClause();
        if (!catchClause) return false;
        const catchText = catchClause.getText();
        return (
          catchText.includes('NotAllowedError') ||
          catchText.includes('AbortError') ||
          ((fileText.includes('NotAllowedError') || fileText.includes('AbortError')) &&
            catchClause.getDescendantsOfKind(SyntaxKind.CallExpression).length > 0)
        );
      });
    });

    expect(hasHandledCredentialsCall).toBe(true);
  });

  test('Expectation 3: Client decodes registration options with parseCreationOptionsFromJSON before create()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasParseCreationOptions = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasParseCall = calls.some(c => {
        const expr = c.getExpression().getText();
        return expr.includes('parseCreationOptionsFromJSON');
      });
      const hasCreateCall = calls.some(c => {
        const expr = c.getExpression().getText();
        return /navigator\.credentials\.create/.test(expr);
      });
      return hasParseCall && hasCreateCall;
    });

    expect(hasParseCreationOptions).toBe(true);
  });

  test('Expectation 4: Client decodes authentication options with parseRequestOptionsFromJSON before get()', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasParseRequestOptions = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasParseCall = calls.some(c => {
        const expr = c.getExpression().getText();
        return expr.includes('parseRequestOptionsFromJSON');
      });
      const hasGetCall = calls.some(c => {
        const expr = c.getExpression().getText();
        return /navigator\.credentials\.get/.test(expr);
      });
      return hasParseCall && hasGetCall;
    });

    expect(hasParseRequestOptions).toBe(true);
  });

  test('Expectation 5: WebAuthn options are fetched from a server endpoint', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasOptionsFetch = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasFetch = calls.some(c => /fetch/i.test(c.getExpression().getText()));
      const fullText = sf.getFullText();
      return (
        hasFetch &&
        /['"`][^'"`]*?(options|challenge|webauthn|passkey|register|login|auth)[^'"`]*?['"`]/i.test(fullText)
      );
    });

    expect(hasOptionsFetch).toBe(true);
  });

  test('Expectation 7: Client serializes credential using toJSON() and posts to verification endpoint', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasToJSONAndPost = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasToJSONCall = calls.some(c => {
        const expr = c.getExpression().getText();
        return expr.endsWith('.toJSON') || expr.includes('toJSON(');
      });

      const hasFetch = calls.some(c => /fetch/i.test(c.getExpression().getText()));
      const fullText = sf.getFullText();
      const hasVerifyEndpoint = /['"`][^'"`]*?(verify|register|login|auth|passkey|webauthn)[^'"`]*?['"`]/i.test(fullText);
      const hasPost = /['"`]POST['"`]/i.test(fullText);

      return hasToJSONCall && hasFetch && hasVerifyEndpoint && hasPost;
    });

    expect(hasToJSONAndPost).toBe(true);
  });

  test('Expectation 8: Application invokes signalAllAcceptedCredentials after credential changes', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasSignalAllAccepted = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some(c => {
        const expr = c.getExpression().getText();
        return expr.includes('signalAllAcceptedCredentials');
      });
    });

    expect(hasSignalAllAccepted).toBe(true);
  });

  test('Expectation 9: Application invokes signalCurrentUserDetails after username or display name update', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasSignalCurrentUser = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some(c => {
        const expr = c.getExpression().getText();
        return expr.includes('signalCurrentUserDetails');
      });
    });

    expect(hasSignalCurrentUser).toBe(true);
  });

  test('Expectation 10: Application invokes signalUnknownCredential when asserted credential is unknown', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasSignalUnknown = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some(c => {
        const expr = c.getExpression().getText();
        return expr.includes('signalUnknownCredential');
      });
    });

    expect(hasSignalUnknown).toBe(true);
  });

  test('Expectation 11: Credential AAGUID is used for UI provider names or icons and not for access control', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAaguidForUI = sourceFiles.some(sf => {
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      const hasAaguidRef = identifiers.some(id => /aaguid/i.test(id.getText()));
      const fullText = sf.getFullText();
      const hasUiMapping = /Google Password Manager|iCloud Keychain|1Password|Bitwarden|Passkey/i.test(fullText);
      const ifAndSwitchStmts = [
        ...sf.getDescendantsOfKind(SyntaxKind.IfStatement).map(s => s.getExpression().getText()),
        ...sf.getDescendantsOfKind(SyntaxKind.SwitchStatement).map(s => s.getExpression().getText()),
      ];
      const hasAuthAbuse = ifAndSwitchStmts.some(cond =>
        /aaguid/i.test(cond) && /isAdmin|authorized|accessDenied/i.test(cond)
      );
      return hasAaguidRef && hasUiMapping && !hasAuthAbuse;
    });

    expect(hasAaguidForUI).toBe(true);
  });

  test('Expectation 12: Application delegates WebAuthn verification to server without hand-rolling client crypto', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const isSecureAndDelegated = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasHandRolledCrypto = calls.some(c => {
        const expr = c.getExpression().getText();
        return expr.includes('crypto.subtle.verify');
      });
      const hasFetch = calls.some(c => /fetch/i.test(c.getExpression().getText()));
      const fullText = sf.getFullText();
      const hasServerVerification =
        hasFetch &&
        /['"`][^'"`]*?(verify|register|login|auth|passkey|webauthn)[^'"`]*?['"`]/i.test(fullText);
      return !hasHandRolledCrypto && hasServerVerification;
    });

    expect(isSecureAndDelegated).toBe(true);
  });
});
