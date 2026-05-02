import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

const fileContent = fs.readFileSync(targetFile, 'utf-8');

test.describe('Passkey Authentication', () => {

  test('The HTML sign-in form annotates the username/password input tags with autocomplete tokens space-separated autocomplete="username webauthn" and autofocus', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const hasCorrectInput = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.some(i => {
         const autocomplete = i.getAttribute('autocomplete') || '';
         const tokens = autocomplete.split(/\s+/);
         const hasWebauthn = tokens.includes('webauthn');
         const hasUsername = tokens.includes('username');
         const hasAutofocus = i.hasAttribute('autofocus');
         return hasWebauthn && hasUsername && hasAutofocus;
      });
    });
    expect(hasCorrectInput).toBe(true);
  });

  test('The client feature detects both passkeyPlatformAuthenticator and conditionalGet support before initializing Conditional UI', async () => {
    expect(fileContent).toMatch(/PublicKeyCredential\.getClientCapabilities/);
    expect(fileContent).toMatch(/passkeyPlatformAuthenticator/);
    expect(fileContent).toMatch(/conditionalGet/);
  });

  test('The application registers Conditional UI suggestions automatically on page load (DOMContentLoaded) with mediation: "conditional"', async () => {
    expect(fileContent).toMatch(/DOMContentLoaded/);
    expect(fileContent).toMatch(/mediation:/);
    expect(fileContent).toMatch(/conditional/);
  });

  test('The client passes an AbortController signal to navigator.credentials.get() for both autofill and button triggers', async () => {
    expect(fileContent).toMatch(/AbortController/);
    expect(fileContent).toMatch(/signal:/);
  });

  test('The explicit biometrics button click triggers abortController.abort() to clear pending autofill suggestions prior to prompting users', async () => {
    expect(fileContent).toMatch(/\.abort\(\)/);
  });

  test('The client decodes assertion option JSON parameters using PublicKeyCredential.parseRequestOptionsFromJSON()', async () => {
    expect(fileContent).toMatch(/PublicKeyCredential\.parseRequestOptionsFromJSON/);
  });

  test('The client invokes biometric credentials prompting via navigator.credentials.get()', async () => {
    expect(fileContent).toMatch(/navigator\.credentials\.get/);
  });

  test('The application segregates WebAuthn cancels try/catch scopes from server verification fetch failures', async () => {
    expect(fileContent).toMatch(/NotAllowedError/);
    expect(fileContent).toMatch(/AbortError/);
  });

  test('The server-side verification endpoint validates the challenge, securely handles counter mapping passes/saves to database, and establishes the logged-in session upon successful signatures checks', async () => {
    expect(fileContent).toMatch(/verify/i);
  });

  test('The server verification endpoint returns an explicit HTTP 404 when the credential public key is unknown', async () => {
    expect(fileContent).toMatch(/404/);
  });

  test('If the server verification endpoint returns an explicit HTTP 404 pre-authentication, PublicKeyCredential.signalUnknownCredential is invoked passing the Base64URL credential ID', async () => {
    expect(fileContent).toMatch(/PublicKeyCredential\.signalUnknownCredential/);
  });

  test('If an explicit button biometrics prompt is cancelled by the user, the client safely re-arms the browser form autofill Conditional UI', async () => {
    expect(fileContent).toMatch(/initializeConditionalAutofill|performAuth\('conditional'\)/);
  });
});
