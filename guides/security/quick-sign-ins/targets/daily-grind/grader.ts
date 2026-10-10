import * as path from 'path';
import { pathToFileURL } from 'url';
import { SyntaxKind } from 'ts-morph';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

const currentFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;

const targetFiles: string[] = getTargetFiles(currentFileUrl);

function getCombinedSourceText(): string {
  const project = getJsProject(targetFiles);
  const jsText = project.getSourceFiles().map(sf => sf.getFullText()).join('\n');
  const htmlDocs = getHtmlDocuments(targetFiles);
  const htmlText = htmlDocs.map(d => d.document.documentElement?.outerHTML || '').join('\n');
  return `${jsText}\n${htmlText}`;
}

test.describe('Quick Sign-Ins with Immediate UI Mode Target Grader', () => {

  test('The implementation MUST import or load the webauthn-polyfills library so PublicKeyCredential.getClientCapabilities, PublicKeyCredential.parseRequestOptionsFromJSON, and PublicKeyCredential.prototype.toJSON are supported', () => {
    const combinedText = getCombinedSourceText();
    const hasWebauthnPolyfills = /webauthn-polyfills/i.test(combinedText);
    expect(hasWebauthnPolyfills).toBe(true);
  });

  test('Before invoking navigator.credentials.get with uiMode: "immediate", the client MUST feature-detect support by calling PublicKeyCredential.getClientCapabilities() and checking capabilities.immediateGet, falling back to the standard sign-in flow when immediateGet is not supported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const combinedText = getCombinedSourceText();

    const hasGetClientCapabilities = sourceFiles.some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText() === 'getClientCapabilities')
    ) || /getClientCapabilities/.test(combinedText);

    const hasImmediateGetCheck = sourceFiles.some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText() === 'immediateGet')
    ) || /\bimmediateGet\b/.test(combinedText);

    expect(hasGetClientCapabilities && hasImmediateGetCheck).toBe(true);
  });

  test('The client MUST invoke navigator.credentials.get inside a user-initiated click handler (and MUST NOT invoke uiMode: "immediate" automatically on page load) with uiMode: "immediate", password: true, and publicKey decoded via PublicKeyCredential.parseRequestOptionsFromJSON', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const combinedText = getCombinedSourceText();

    const hasParseRequestOptions = /parseRequestOptionsFromJSON/.test(combinedText);

    const immediateCalls = sourceFiles.flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
        const exprText = call.getExpression().getText();
        if (!/credentials\.get$/.test(exprText)) return false;
        const argText = call.getArguments()[0]?.getText() || '';
        return /uiMode\s*:\s*['"`]immediate['"`]|ui_mode|uiMode/.test(argText);
      })
    );

    const hasImmediateCallWithPasswordAndPublicKey = immediateCalls.some(call => {
      const argText = call.getArguments()[0]?.getText() || '';
      return /password\s*:\s*true/.test(argText) && /\bpublicKey\b/.test(argText);
    }) || (
      /navigator\.credentials\.get\s*\(\s*\{[\s\S]*?password\s*:\s*true[\s\S]*?publicKey[\s\S]*?uiMode\s*:\s*['"`]immediate['"`]/m.test(combinedText) ||
      /navigator\.credentials\.get\s*\(\s*\{[\s\S]*?uiMode\s*:\s*['"`]immediate['"`][\s\S]*?password\s*:\s*true/m.test(combinedText)
    );

    const hasClickTrigger = /addEventListener\s*\(\s*['"`]click['"`]|onClick/i.test(combinedText);

    expect(hasParseRequestOptions && hasImmediateCallWithPasswordAndPublicKey && hasClickTrigger).toBe(true);
  });

  test('The immediate credential request MUST NOT pass an AbortSignal (signal) to navigator.credentials.get when uiMode is "immediate"', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const immediateCalls = sourceFiles.flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
        const exprText = call.getExpression().getText();
        if (!/credentials\.get$/.test(exprText)) return false;
        const argText = call.getArguments()[0]?.getText() || '';
        return /uiMode\s*:\s*['"`]immediate['"`]/.test(argText);
      })
    );

    expect(immediateCalls.length).toBeGreaterThan(0);

    const anyImmediateCallPassesSignal = immediateCalls.some(call => {
      const firstArg = call.getArguments()[0];
      if (!firstArg || firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) return false;
      const obj = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
      return obj.getProperties().some(prop => {
        const propText = prop.getText();
        return /^\s*signal\b/.test(propText);
      });
    });

    expect(anyImmediateCallPassesSignal).toBe(false);
  });

  test('When navigator.credentials.get resolves with a credential, the client MUST handle both credential types by checking credential.type: serializing a "public-key" credential with .toJSON() for the WebAuthn verification endpoint, or sending a "password" credential\'s id and password to the password verification endpoint', () => {
    const combinedText = getCombinedSourceText();

    const checksPublicKeyType = /['"`]public-key['"`]/.test(combinedText);
    const checksPasswordType = /['"`]password['"`]/.test(combinedText);
    const callsToJson = /\.toJSON\s*\(/.test(combinedText);
    const accessesPasswordField = /\.password\b/.test(combinedText);

    expect(checksPublicKeyType && checksPasswordType && callsToJson && accessesPasswordField).toBe(true);
  });

  test('If the WebAuthn verification endpoint returns an HTTP 404 status for an unknown credential, the client MUST invoke PublicKeyCredential.signalUnknownCredential (when available) with rpId and the Base64URL-encoded credential ID', () => {
    const combinedText = getCombinedSourceText();

    const checks404 = /\b404\b/.test(combinedText);
    const callsSignalUnknown = /signalUnknownCredential\s*\(/.test(combinedText);
    const passesRpIdAndCredentialId = /\brpId\b/.test(combinedText) && /\bcredentialId\b/.test(combinedText);

    expect(checks404 && callsSignalUnknown && passesRpIdAndCredentialId).toBe(true);
  });

  test('When navigator.credentials.get rejects with NotAllowedError (or when immediateGet is unsupported), the client MUST catch the error and transition to a fallback sign-in experience (such as revealing a fallback sign-in form/modal or navigating to the sign-in page)', () => {
    const combinedText = getCombinedSourceText();

    const catchesNotAllowedError = /NotAllowedError/.test(combinedText);
    const hasTryCatch = /\btry\s*\{[\s\S]*?\}\s*catch\b/.test(combinedText);
    const hasFallbackTransition = /fallback|signin|sign-in|modal|dialog|location\.href|location\.assign/i.test(combinedText);

    expect(catchesNotAllowedError && hasTryCatch && hasFallbackTransition).toBe(true);
  });

});
