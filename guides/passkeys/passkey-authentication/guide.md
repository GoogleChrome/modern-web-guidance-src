---
name: passkey-authentication
description: Authenticate a returning user with a passkey for primary sign-in.
web-feature-ids:
  - webauthn
  - webauthn-signals
  - webauthn-public-key-easy
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
  - https://www.w3.org/TR/webauthn-3/
  - https://web.dev/articles/passkey-form-autofill
---

# Passkey Authentication Guide

This guide details how to implement returning user authentication using discoverable credentials, both through explicit button triggers and seamless browser autofill suggestions (Conditional UI).

## Server-Side

### Options Generation

Create a `/login/options` endpoint that generates WebAuthn request parameters using a vetted library per standards.

1.  **Generate assertion Challenge**: Generate a high-entropy, cryptographically secure random buffer, store it securely in the user's session, and encode it as Base64URL.
2.  **Discoverable Credentials mapping**: Specify an empty array `[]` for `allowCredentials`. This requests discoverable credentials, meaning the user does not need to enter their username first; the passkey provider will present available accounts.
3.  **User Verification level**: Set `userVerification: "preferred"` (or `"required"` if explicitly mandated by corporate compliance policies).
    *   `MANDATORY:` The requested `userVerification` constraint level MUST be persisted inside the server session record at the options endpoint, rather than passed back from the client via query strings. This allows the verification endpoint to enforce strict matching constraints safely without risk of client manipulation.

```javascript
// Options generation example (discoverable flow)
const options = {
  challenge: serverGeneratedBase64UrlChallenge, // High-entropy random challenge stored in session
  rpId: "example.com",
  allowCredentials: [], // Request discoverable passkeys
  userVerification: "preferred"
};

// Persist expected UV level to user session
req.session.expectedUserVerification = "preferred";
```

### Verification Endpoint

Securely verify the assertion Returned by the client to authenticate the user:

1.  **Validate session challenge**: Enforce strict challenge matching between the client response and the expected challenge stored in the session.
2.  **Verify Cryptographic Signature**:
    *   `MANDATORY:` Fetch the Base64URL-encoded `credentialPublicKey` from your database record, convert it into a standard public key buffer, and verify the returned `signature` returned in the client assertion response. Signature validation is the core cryptographic check protecting the authentication flow.
3.  **Verify User Presence**:
    *   `MANDATORY:` Verify that the User Present (UP) flag returned inside the parsed authenticator data is `true` to confirm user presence during assertion validation.
4.  **Enforce UV Preferences**: 
    *   `MANDATORY:` Allow UV-less authenticators (e.g., authenticator screen locks disabled) if the session's `expectedUserVerification` requested `"preferred"`, by passing `requireUserVerification: false` to your server-side verification library. If requested `"required"`, enforce biometrics/PIN entry strictly.
5.  **Handle Counter Parameters (Clone Prevention)**:
    *   `MANDATORY:` Fetch the previously stored `counter` parameter from the database record. Pass it to the verification routine to detect cloned authenticators.
    *   `MANDATORY:` Skip strictly incrementing checks if both the old and new counters are `0` (the standard signature for multi-device synced passkeys), while strictly enforcing incrementing counter verification only for hardware-bound security keys to detect clones.
    *   `MANDATORY:` Save the returned `newCounter` parameter back to the database record immediately upon successful verification to update the clone-detection marker.
6.  **Clean Server Error 404**: If the credential ID returned by the client is not found in the database, return an explicit HTTP `404` error so the client can trigger the Signal API.
7.  **Establish the authenticated session**:
    *   `MANDATORY:` On successful verification, mark the user as authenticated in your session store (e.g. `req.session['signed-in'] = true` or your equivalent). Verification without session establishment leaves the user un-logged-in despite a successful biometric prompt.

## Client-Side Logic

### HTML Form Annotation

Annotate your username and password inputs to natively leverage Conditional UI. Autocomplete tokens combine the webauthn spec parameters, and autofocus triggers the autofill biometrics popup immediately when the input is focused:

```html
<!-- Autocomplete tokens must contain webauthn space-separated -->
<form id="signin-form">
  <input type="text" name="username" autocomplete="username webauthn" autofocus data-testid="username-field">
  <input type="password" name="password" autocomplete="current-password">
  <button type="submit">Sign in</button>
</form>
```

### Explicit Button Flow

Trigger passkey authentication when a user clicks a "Sign in with passkey" button. Abort any ongoing form autofill (Conditional Get) calls before invoking the biometric prompt.

### Conditional Mediation Flow (Form Autofill)

Activate form autofill suggestions on page load to offer passkey authentication natively when users focus on sign-in fields:

1.  **Feature detect conditional capability**: Ensure both `passkeyPlatformAuthenticator` and `conditionalGet` are true using `PublicKeyCredential.getClientCapabilities()`.
2.  **Invoke Conditional Get**: Call `navigator.credentials.get()` with `mediation: "conditional"` and pass an `AbortController` signal. This registers autofill silently without rendering biometrics popups.
3.  **Try/Catch Exception Segregation**: Wrap `navigator.credentials.get` and the subsequent server verification `fetch()` call in distinct try/catch blocks:
    *   `NotAllowedError`: The user cancelled or timed out the biometrics login prompt.
    *   `AbortError`: The programmatic authentication request was cancelled.
    *   `MANDATORY:` Call `signalUnknownCredential()` ONLY when the server explicitly responds with HTTP status `404` (Credential not found) and the user is unauthenticated. Do NOT call it for standard WebAuthn cancels (`NotAllowedError`, `AbortError`) or other server errors to prevent false alarms.
    *   `MANDATORY:` The `credentialId` parameter passed to `signalUnknownCredential()` MUST strictly be the Base64URL-encoded credential ID string (e.g., `encoded.id`), NOT the raw ArrayBuffer object `credential.rawId`.

```javascript
// optionsFetch and loginVerifyFetch are app-defined HTTP methods
import { optionsFetch, loginVerifyFetch } from './api.js';

let autofillAbortController = new AbortController();

async function initializeConditionalAutofill() {
  // Feature detect Conditional Get autofill support
  if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
    const capabilities = await PublicKeyCredential.getClientCapabilities();
    if (capabilities.passkeyPlatformAuthenticator && capabilities.conditionalGet === true) {
      // MANDATORY: The client MUST fetch options JSON from the options generation server endpoint prior to invoking credentials get mediation.
      const loginOptionsJSON = await optionsFetch();
      const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(loginOptionsJSON);

      try {
        // Initiate Conditional UI form autofill suggestions
        const credential = await navigator.credentials.get({
          publicKey,
          signal: autofillAbortController.signal,
          mediation: 'conditional'
        });

        // Segregated verification fetch
        const encoded = credential.toJSON();
        const response = await loginVerifyFetch(encoded);
        if (!response.ok && response.status === 404) {
          // Note: this code path runs pre-authentication, satisfying the unauth precondition
          if (PublicKeyCredential.signalUnknownCredential) {
            await PublicKeyCredential.signalUnknownCredential({
              rpId: window.location.hostname,
              credentialId: encoded.id
            });
          }
        }
      } catch (err) {
        // Silently swallow expected client WebAuthn exceptions
        if (['NotAllowedError', 'AbortError'].includes(err.name)) {
          return;
        }
        console.error('Unexpected conditional get error:', err);
      }
    }
  }
}

async function triggerButtonAuthentication() {
  // Abort any pending Conditional Get call to prevent biometrics prompt collisions
  autofillAbortController.abort();
  autofillAbortController = new AbortController(); // Reset controller for next triggers

  const loginOptionsJSON = await optionsFetch();
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(loginOptionsJSON);

  let credential;
  try {
    // Biometric explicit prompt trigger
    credential = await navigator.credentials.get({
      publicKey,
      signal: autofillAbortController.signal
    });
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      console.log('User cancelled biometrics login.');
    } else if (err.name === 'AbortError') {
      console.log('The authentication operation was aborted.');
    }
    // Re-arm Conditional autofill Suggestions after cancelled explicit button prompts
    initializeConditionalAutofill();
    return; // Safe exit
  }

  // Segregated verification try/catch (HTTP 404 trigger)
  const encoded = credential.toJSON();
  try {
    const response = await loginVerifyFetch(encoded);
    if (!response.ok && response.status === 404) {
      // Note: this code path runs pre-authentication, satisfying the unauth precondition
      if (PublicKeyCredential.signalUnknownCredential) {
        await PublicKeyCredential.signalUnknownCredential({
          rpId: window.location.hostname,
          credentialId: encoded.id
        });
      }
    }
  } catch (serverErr) {
    console.error('Verification request error:', serverErr);
  }
}

// Trigger Conditional Get on load
window.addEventListener('DOMContentLoaded', initializeConditionalAutofill);
```

## Fallback Strategies

### Biometrics Authentication Fallback

{{ BASELINE_STATUS("webauthn") }}

Passkey authentication is a progressive enhancement. If platform authenticators are unsupported by the device, the application MUST fallback immediately to standard forms.
*   **Fallback Experience**: Gracefully fallback to traditional password inputs or browser-stored password autofill flows natively.
*   **Feature Detection**:
    ```javascript
    if (!window.PublicKeyCredential || !PublicKeyCredential.getClientCapabilities) {
      // Fallback immediately to traditional password field forms
      showStandardPasswordFields();
    }
    ```

### Signal API Synchronization Fallback

{{ BASELINE_STATUS("webauthn-signals") }}

The WebAuthn Signal API (`webauthn-signals`) is a progressive optimization used to keep password managers in sync with the server credential state.
*   **Fallback Experience**: Gated via `if (PublicKeyCredential.signalUnknownCredential)`. If unsupported, the background verification sync is bypassed gracefully without throwing browser exceptions.

### Easy JSON Serialization Fallback

{{ BASELINE_STATUS("webauthn-public-key-easy") }}

The WebAuthn JSON serialization helper methods represent progressive optimizations.
*   **Fallback Experience**: If `PublicKeyCredential.parseRequestOptionsFromJSON` or `credential.toJSON` are unsupported by the browser, the application MUST gracefully fall back to manual base64url-to-ArrayBuffer encoding and decoding helper scripts to parse options and verify credentials safely.
