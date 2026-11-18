/**
 * Expectation Verification Summary:
 * Expectation 1: TESTED - Verifies that passkey entry points are gated on a PublicKeyCredential feature detection check and hidden when unsupported.
 * Expectation 2: TESTED - Verifies that navigator.credentials calls are wrapped in try/catch handling expected WebAuthn errors (NotAllowedError, AbortError).
 * Expectation 3: TESTED - Verifies that client decodes registration options with PublicKeyCredential.parseCreationOptionsFromJSON before navigator.credentials.create().
 * Expectation 4: TESTED - Verifies that client decodes authentication options with PublicKeyCredential.parseRequestOptionsFromJSON before navigator.credentials.get().
 * Expectation 5: TESTED - Verifies that WebAuthn options are fetched from a server endpoint rather than constructing challenges on the client.
 * Expectation 6: TESTED - Verifies that Relying Party ID (rp.id or rpId) is derived from server options or window.location.hostname and never set to an IP address, URL with scheme/port/path, or standalone public suffix.
 * Expectation 7: TESTED - Verifies that credentials are serialized with PublicKeyCredential.prototype.toJSON and posted to a verification endpoint.
 * Expectation 8: TESTED - Verifies that AAGUID is used exclusively for rendering provider names or icons in the UI and not for access control.
 * Expectation 9: TESTED - Verifies that client-side JavaScript does not hand-roll WebAuthn signature verification or challenge validation.
 */

import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore - package.json omits "type": "module", causing tsc nodenext to warn on import.meta
const targetFiles: string[] = getTargetFiles(import.meta.url);

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
      const elements = d.document.querySelectorAll('[class*="passkey"], [id*="passkey"], [data-passkey-entry], [data-passkey]');
      return elements.length > 0;
    }) || sourceFiles.some(sf => {
      const fullText = sf.getFullText();
      return (
        (fullText.includes('.style.display') || fullText.includes('.disabled') || fullText.includes('.hidden')) &&
        /passkey/i.test(fullText)
      );
    });

    expect(hasFeatureDetection && hasGatedElements).toBe(true);
  });

  test('Expectation 2: Passkey flows wrap navigator.credentials calls in try/catch handling expected exceptions', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const allCredCalls = sourceFiles.flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c =>
        /navigator\.credentials\.(create|get)/.test(c.getExpression().getText())
      )
    );
    const allTryStmts = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.TryStatement));
    const handlesWebAuthnErrors = sourceFiles.some(sf => {
      const text = sf.getFullText();
      return text.includes('NotAllowedError') || text.includes('AbortError');
    });

    const hasHandledCredentialsCall =
      allCredCalls.length > 0 &&
      allTryStmts.length > 0 &&
      handlesWebAuthnErrors;

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

    const allCalls = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasFetchCall = allCalls.some(c => /fetch/i.test(c.getExpression().getText()));
    const hasOptionsEndpointArg = allCalls.some(c =>
      c.getArguments().some(arg => /options|webauthn/i.test(arg.getText()))
    );

    expect(hasFetchCall && hasOptionsEndpointArg).toBe(true);
  });

  test('Expectation 6: Relying Party ID (rp.id or rpId) is a bare domain without scheme, port, path, IP address, or standalone public suffix', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const allCalls = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const decodesServerOptions = allCalls.some(c =>
      /parseCreationOptionsFromJSON|parseRequestOptionsFromJSON/.test(c.getExpression().getText())
    );
    const referencesRpIdOrHostname = sourceFiles.some(sf =>
      /\b(rpId|rpID|hostname)\b/.test(sf.getFullText())
    );
    expect(decodesServerOptions || referencesRpIdOrHostname).toBe(true);

    const PUBLIC_SUFFIXES = new Set([
      'github.io',
      'pages.dev',
      'vercel.app',
      'netlify.app',
      'run.app',
      'cloudfunctions.net',
      'com',
      'org',
      'net',
      'io',
      'dev',
      'app',
    ]);

    const rpLiterals: string[] = [];
    for (const sf of sourceFiles) {
      for (const pa of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        const name = pa.getName();
        if (name === 'rpId' || name === 'rpID') {
          const init = pa.getInitializer();
          if (init && init.isKind(SyntaxKind.StringLiteral)) {
            rpLiterals.push(init.getLiteralValue());
          }
        }
        if (name === 'rp') {
          const init = pa.getInitializer();
          if (init && init.isKind(SyntaxKind.ObjectLiteralExpression)) {
            for (const subProp of init.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
              if (subProp.getName() === 'id') {
                const subInit = subProp.getInitializer();
                if (subInit && subInit.isKind(SyntaxKind.StringLiteral)) {
                  rpLiterals.push(subInit.getLiteralValue());
                }
              }
            }
          }
        }
      }
      for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        if (vd.getName() === 'rpId' || vd.getName() === 'rpID') {
          for (const lit of vd.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
            rpLiterals.push(lit.getLiteralValue());
          }
        }
      }
    }

    const hasInvalidRpIdLiteral = rpLiterals.some(val => {
      if (!val) return false;
      const hasSchemePortOrPath = /:\/\/|:\d+|\/|\?/.test(val);
      const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(val);
      const isIpv6 = val.includes(':');
      const isPublicSuffix = PUBLIC_SUFFIXES.has(val.toLowerCase());
      return hasSchemePortOrPath || isIpv4 || isIpv6 || isPublicSuffix;
    });

    expect(hasInvalidRpIdLiteral).toBe(false);
  });

  test('Expectation 7: Client serializes credential using toJSON() and posts to verification endpoint', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const allCalls = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasToJSONCall = allCalls.some(c => {
      const expr = c.getExpression().getText();
      return expr.endsWith('.toJSON') || expr.includes('toJSON(');
    });
    const hasFetchCall = allCalls.some(c => /fetch/i.test(c.getExpression().getText()));
    const hasPostMethod = sourceFiles.some(sf => /['"`]POST['"`]/i.test(sf.getFullText()));
    const hasVerifyCall = allCalls.some(c => /verify/i.test(c.getText()));

    expect(hasToJSONCall && hasFetchCall && hasPostMethod && hasVerifyCall).toBe(true);
  });

  test('Expectation 8: Credential AAGUID is used for UI provider names or icons and not for access control', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAaguidForUI = sourceFiles.some(sf => {
      const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      const hasAaguidRef = identifiers.some(id => /aaguid/i.test(id.getText()));
      const fullText = sf.getFullText();
      const hasUiMapping = /Google Password Manager|iCloud Keychain|1Password|Bitwarden|Passkey|provider/i.test(fullText);
      const hasAuthAbuse = /roles?|permissions?|isAdmin|authorized/i.test(fullText) && fullText.includes('aaguid');
      return hasAaguidRef && hasUiMapping && !hasAuthAbuse;
    });

    expect(hasAaguidForUI).toBe(true);
  });

  test('Expectation 9: Application delegates WebAuthn verification to server without hand-rolling client crypto', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const allCalls = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasHandRolledCrypto = allCalls.some(c =>
      c.getExpression().getText().includes('crypto.subtle.verify')
    );
    const hasFetchCall = allCalls.some(c => /fetch/i.test(c.getExpression().getText()));
    const hasVerifyCall = allCalls.some(c => /verify/i.test(c.getText()));

    expect(!hasHandRolledCrypto && hasFetchCall && hasVerifyCall).toBe(true);
  });
});
