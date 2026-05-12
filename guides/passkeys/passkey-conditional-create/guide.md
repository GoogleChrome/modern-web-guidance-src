---
name: passkey-conditional-create
description: Silently register a passkey for an existing user after a successful password login.
web-feature-ids:
  - webauthn
  - webauthn-signals
sources:
  - https://web.dev/articles/passkey-registration
  - https://www.w3.org/TR/webauthn-3/
---

# Passkey Conditional Create (Post-Login Promotion)

This guide details how to automatically and silently register a passkey for a user immediately after a successful password-based sign-in, minimizing friction and boosting passkey adoption.

## The Right Trigger Moment

Automatic passkey creation (also known as Conditional Create or silent post-login promotion) MUST only be triggered **immediately after a successful, full sign-in that involved a password**. 
* Do not attempt conditional creation for passwordless flows (e.g., magic links, SMS OTP, or identity federation).
* If multi-factor authentication is required, you MUST wait until all factors have succeeded before initiating conditional creation.
* Ensure a valid, authenticated user session is active before making requests to creation endpoints.

## Implementation Steps

### 1. Abort Prior Autofill Actions
If the sign-in page utilizes form autofill (Conditional UI/Get), the active credential get call must be aborted to prevent browser conflicts.
* Call `abortController.abort()` on the `AbortController` attached to the pending `navigator.credentials.get()` autofill request before calling `navigator.credentials.create()`.

### 2. Feature Detection
Determine whether Conditional Create is available by checking `conditionalCreate` with `PublicKeyCredential.getClientCapabilities()`.

```javascript
if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
  const capabilities = await PublicKeyCredential.getClientCapabilities();
  if (capabilities.conditionalCreate) {
    // Conditional create is available
  }
}
```

### 3. Call Creation with Conditional Mediation
* Pass `mediation: 'conditional'` within the `navigator.credentials.create()` options. This signals the browser to handle the passkey creation flow silently in the background or contextually without throwing obtrusive modal dialogs.
* Populate `excludeCredentials` with the user's existing passkey credential IDs to avoid registering duplicate keys.

### 4. Silent Error Handling
* Wrap the passkey creation prompt (`navigator.credentials.create`) in a try/catch block. You MUST catch and silently ignore typical user-facing exceptions (`InvalidStateError`, `NotAllowedError`, `AbortError`) without rendering any error UI to the user.

### 5. Server-Side Presence Verification
* The server-side verification endpoint MUST relax the User Presence (UP) requirement (`requireUserPresence: false`) **ONLY** when verifying credentials produced by a conditional-create trigger. Strict presence verification must remain active for standard explicit creations.

### 6. Handle Failed Server Verification gracefully
* If `navigator.credentials.create()` succeeds but the server verification fetch returns a bad response (e.g., signature verification fails), invoke `PublicKeyCredential.signalUnknownCredential()` passing the Base64URL-encoded credential ID to prevent orphaned credentials from lingering in the password manager.

## Code Example

```javascript
// optionsFetch and registerVerifyFetch are app-defined server endpoint requests
import { optionsFetch, registerVerifyFetch } from './api.js';

async function triggerConditionalCreate(loginAbortController) {
  if (!window.PublicKeyCredential || !PublicKeyCredential.getClientCapabilities) {
    return; // Fallback gracefully if APIs are missing
  }

  const capabilities = await PublicKeyCredential.getClientCapabilities();
  if (capabilities.conditionalCreate !== true) {
    return; // Platform does not support conditional creation
  }

  // 1. Abort any active autofill conditional-get controllers to clear the WebAuthn pipeline
  loginAbortController.abort();

  // 2. Fetch creation options signaling the backend that this is a conditional request
  const creationOptionsJSON = await optionsFetch({ conditional: true });
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(creationOptionsJSON);

  let credential;
  try {
    // 3. Invoke silent credentials creation prompt
    credential = await navigator.credentials.create({ 
      publicKey,
      mediation: 'conditional' // Silent background creation mediation
    });
  } catch (e) {
    // 4. Silently swallow common WebAuthn browser exceptions
    if (['InvalidStateError', 'NotAllowedError', 'AbortError'].includes(e.name)) {
      return; 
    }
    console.error('Unexpected conditional create error:', e);
    return;
  }

  // 5. Server verification step using dedicated Try/Catch block
  let encodedResponse = credential.toJSON();
  try {
    const response = await registerVerifyFetch(encodedResponse);
    if (!response.ok) {
      // If the server verification fails, clean up using Signal API
      if (PublicKeyCredential.signalUnknownCredential) {
        await PublicKeyCredential.signalUnknownCredential({
          rpId: window.location.hostname,
          credentialId: encodedResponse.id
        });
      }
    }
  } catch (serverErr) {
    console.error('Verification network failure:', serverErr);
    if (PublicKeyCredential.signalUnknownCredential) {
      await PublicKeyCredential.signalUnknownCredential({
        rpId: window.location.hostname,
        credentialId: encodedResponse.id
      });
    }
  }
}
```

## Fallback Strategies

### Conditional Create Fallback

{{ BASELINE_STATUS("webauthn", "api.PublicKeyCredential.getClientCapabilities_static") }}

Conditional passkey creation is an optional progressive optimization. If the device does not support `conditionalCreate`:
*   **Fallback Experience**: The page should complete the login successfully and direct the user to their home feed normally, without displaying any fallback error or passkey dialogs.
*   **Explicit Option**: You can optionally present an explicit "Add passkey" promotion banner later in their account home feed to encourage manual setup.

### Signal API Synchronization Fallback

{{ BASELINE_STATUS("webauthn-signals") }}

The WebAuthn Signal API (`webauthn-signals`) is a progressive optimization used to keep password managers in sync with the server credential state.
*   **Fallback Experience**: Gated via `if (PublicKeyCredential.signalUnknownCredential)`. If unsupported, the background verification sync is bypassed gracefully without throwing browser exceptions.

### Easy JSON Serialization Fallback

{{ BASELINE_STATUS("webauthn", "api.PublicKeyCredential.parseCreationOptionsFromJSON_static") }}

The WebAuthn JSON serialization helper methods represent progressive optimizations.
*   **Fallback Experience**: If `PublicKeyCredential.parseCreationOptionsFromJSON` or `credential.toJSON` are unsupported by the browser, the application MUST gracefully fall back to manual base64url-to-ArrayBuffer encoding and decoding helper scripts to parse options and verify credentials safely.
