---
name: passkey-registration
description: Register a passkey for an existing user account.
web-feature-ids:
  - webauthn
  - webauthn-signals
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
  - https://www.w3.org/TR/webauthn-3/
  - https://raw.githubusercontent.com/passkeydeveloper/passkey-authenticator-aaguids/refs/heads/main/combined_aaguid.json
  - https://web.dev/articles/passkey-registration
---

# Passkey Registration Guide

This guide details how to enable users to register a passkey for their account, providing a highly secure, phishing-resistant passwordless sign-in alternative.

## Database Requirements

To support passkey registrations, your database credential table must store the following fields:

```typescript
export interface StoredPasskeyCredential {
  id: string; // Base64URL-encoded credential ID (unique lookup key)
  passkeyUserId: string; // Associated application user ID
  credentialPublicKey: string; // Base64URL-encoded public key used to verify assertion signatures
  credentialType: 'public-key'; 
  credentialDeviceType: 'singleDevice' | 'multiDevice'; // Helps distinguish device-bound vs cloud-synced passkeys
  credentialBackedUp: boolean; // Boolean backup state reported by the authenticator
  aaguid: string; // Authenticator Attestation GUID
  providerIcon?: string; // Provider icon derived from the AAGUID registry (dark or light theme URLs)
  name: string; // Provider name derived from AAGUID registry
  transports: string[]; // Array of transport names (e.g. 'internal', 'hybrid') necessary for exclusion options
  lastUsedAt?: number; // Optional epoch timestamp of last sign-in
  registeredAt: number; // Registration epoch timestamp
  counter: number; // Authenticator sign-in signature counter used to prevent replay attacks
}
```

## Server-Side

### Options Generation

Create a `/register/options` endpoint that generates WebAuthn creation parameters. Developers MUST rely on a vetted library per category standards instead of hand-rolling cryptography.

1.  **Create a secure Challenge**: Generate a high-entropy, cryptographically secure random buffer on the server, store it securely in the user's session, and encode it as Base64URL for options delivery.
2.  **Avoid Duplicate Passkeys**: Map the user's existing pre-registered passkey IDs to the `excludeCredentials` options array. This prevents the authenticator from registering duplicate credentials on the same biometric device or password manager account.
3.  **Enforce Resident and Discoverable Keys**: Set `requireResidentKey: true` and `residentKey: "required"` in the `authenticatorSelection` options to request a discoverable resident key, which is necessary for discoverable form autofill sign-ins.
4.  **Configure User Verification**: Specify `userVerification: "preferred"` or `userVerification: "required"`. Many compliance use cases (e.g., finance, healthcare) require `'required'` to enforce hardware biometrics or PIN entry on creation.
5.  **Determine Attachment Scope**:
    *   **Promotion Flow**: When proposing passkey auto-creation right after standard password sign-ins or post-signup promotions, set `authenticatorAttachment: "platform"` to enforce built-in biometric hardware and bypass hardware key prompts.
    *   **Management Flow**: When called from a dedicated settings or security panel where external hardware security keys (e.g., YubiKeys) are supported in addition to biometrics, omit the `authenticatorAttachment` property entirely.
    *   *Tip*: Accept a `promotion: boolean` request flag to conditionally handle both flows with a single endpoint.

```javascript
// Options generation example
const options = {
  challenge: serverGeneratedBase64UrlChallenge, // Cryptographically random challenge
  rp: { id: "example.com", name: "Secure Application" },
  user: {
    id: userBase64UrlId, // Unique base64url string identifying the account
    name: "user@example.com",
    displayName: "Jane Doe"
  },
  pubKeyCredParams: [{ type: "public-key", alg: -7 }], // Enforce ES256 (standard platform algorithm)
  excludeCredentials: userExistingCredentials.map(cred => ({
    type: "public-key",
    id: cred.id
  })),
  authenticatorSelection: {
    residentKey: "required",
    requireResidentKey: true,
    userVerification: "preferred", // Fallback to PIN if biometrics aren't ready
    // Biometric platform attachment only used during promotion workflows
    ...(isPromotionFlow && { authenticatorAttachment: "platform" })
  }
};
```

### Verification & AAGUID Lookup

1.  **Challenge Verification**: Securely verify the attestation challenge against the expected session bound challenge.
2.  **Relaxing Verification for 'preferred'**: 
    *   `MANDATORY:` When the creation options specified `userVerification: "preferred"`, the server-side verification call MUST be configured with `requireUserVerification: false`. Otherwise, authenticators that register without user biometrics (e.g., screen locks disabled) will trigger spurious server verification failures.
3.  **AAGUID Resolution**: Fetch the AAGUID UUID string from the attestation data and look it up against the AAGUID registry to populate metadata:
    *   `MANDATORY:` Authenticator providers return a zeroed AAGUID (`00000000-0000-0000-0000-000000000000`) for certain platform settings. When encountered, skip registry lookups entirely. Fall back to user-agent parsing or "Unknown passkey provider" and leave `providerIcon` undefined. Do NOT pass a zeroed AAGUID to the registry.
4.  **Transports Persistence**: Persist `response.getTransports()` as the `transports` field inside the database record; this list is required for excluding existing credentials in subsequent flows.
5.  **Return HTTP 404 on Missing Keys**:
    *   `MANDATORY:` If the credential public key matching the Returned ID is missing or cannot be found in the database, the verification endpoint MUST respond with an explicit HTTP `404` status to safely trigger the Signal API.

## Client-Side Logic

1.  **Feature Detect capabilities**: Ensure the current browser supports passkeys using `PublicKeyCredential.getClientCapabilities()` before offering UI prompts.
2.  **Invoke creation**: Decode server options with `PublicKeyCredential.parseCreationOptionsFromJSON()` and pass the resulting configuration to `navigator.credentials.create()`.
3.  **Handle WebAuthn Exceptions**:
    *   `InvalidStateError`: A matching passkey already exists (matched by `excludeCredentials`).
    *   `NotAllowedError`: The user cancelled or timed out the authentication biometrics dialog.
    *   `AbortError`: The operation has been aborted.
    *   `SecurityError`: Secure origins (HTTPS) or RP ID mismatch errors (configuration issues).
4.  **Try/Catch Segregation for Signal API**:
    *   `MANDATORY:` Wrap `navigator.credentials.create` and the subsequent server verification `fetch()` call in distinct try/catch blocks. Call `signalUnknownCredential()` ONLY when the server verification fetch fails (any status `response.ok === false` or network throws), not during standard WebAuthn API exceptions. Broadly catching all server errors ensures credentials aren't left orphaned and out-of-sync in password managers.

```javascript
// optionsFetch and registerVerifyFetch are app-defined HTTP methods
import { optionsFetch, registerVerifyFetch } from './api.js';

async function registerPasskey(isPromotion = false) {
  // Verify biometric platform capability exists on device
  if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
    const capabilities = await PublicKeyCredential.getClientCapabilities();
    if (!capabilities.passkeyPlatformAuthenticator) {
      // Hide "Create passkey" buttons and fall back to password flows instead
      showStandardPasswordFallbackUI();
      return;
    }
  }

  const creationOptionsJSON = await optionsFetch({ promotion: isPromotion });
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(creationOptionsJSON);

  let credential;
  try {
    // Biometrics prompt execution
    credential = await navigator.credentials.create({ publicKey });
  } catch (err) {
    if (err.name === 'InvalidStateError') {
      console.log('A passkey already exists for this account.');
    } else if (err.name === 'SecurityError') {
      console.error('Configuration RP ID or Secure Context error.');
    } else if (err.name === 'NotAllowedError') {
      console.log('User cancelled the biometrics dialog.');
    } else if (err.name === 'AbortError') {
      console.log('The creation operation has been aborted.');
    }
    return; // Safe API exit, do not signal unknown for standard WebAuthn cancels
  }

  // Server Verification phase (Segregated Try/Catch)
  let encodedResponse = credential.toJSON();
  try {
    const response = await registerVerifyFetch(encodedResponse);
    if (!response.ok) {
      // Server verification failed to verify/authenticate the credential (orphaned)
      if (PublicKeyCredential.signalUnknownCredential) {
        await PublicKeyCredential.signalUnknownCredential({
          rpId: window.location.hostname,
          credentialId: encodedResponse.id
        });
      }
    }
  } catch (serverErr) {
    console.error('Server verification network failure:', serverErr);
    if (PublicKeyCredential.signalUnknownCredential) {
      await PublicKeyCredential.signalUnknownCredential({
        rpId: window.location.hostname,
        credentialId: encodedResponse.id
      });
    }
  }
}
```

## Conditional Create (Promotion Flow)

Conditional Create allows applications to automatically generate passkeys for users at the right moment without requiring any explicit creation prompts, reducing friction in passkey adoption.

1.  **Identify the Right Moment**: Invoke Conditional Create **immediately after a successful, full sign-in that involved a password**. Passwordless sign-in methods such as magic links, SMS OTP, or identity federation do not qualify. If multi-factor authentication is required, you MUST wait until all factors are successful before initiating conditional create.
2.  **Abort Ongoing Conditional Get**: If your login page uses form autofill (Conditional UI/Get), you MUST abort the ongoing `navigator.credentials.get()` call before invoking conditional create using your AbortController (`abortController.abort()`).
3.  **Feature Detection**: Verify capability using `capabilities.conditionalCreate` within `PublicKeyCredential.getClientCapabilities()`.
4.  **Trigger Conditionally**: Invoke `navigator.credentials.create()` but pass `mediation: "conditional"`. Ensure `excludeCredentials` is populated to avoid duplicates.
5.  **Silent Exception Handling**: If automatic creation fails, the browser handles it silently. You MUST catch and ignore all WebAuthn API exceptions (`InvalidStateError`, `NotAllowedError`, `AbortError`) without rendering error UI to avoid confusing the user.
6.  **Server-side Sync on Failure**:
    *   `MANDATORY:` Just as in the regular registration flow, if the passkey is successfully created by the provider but fails to verify or register on the server (re-verification fails), you MUST invoke `signalUnknownCredential()` to prevent the credential from being left orphaned in the password manager.
7.  **Relaxing User Presence**:
    *   `MANDATORY:` The server MUST conditionally relax User Presence checks (`requireUserPresence: false`) ONLY during credential verification for conditional-create requests, while continuing to enforce strict presence checks for standard registrations. The user session MUST still be thoroughly validated before creation endpoints respond.

```javascript
// Example Conditional Create trigger (post-login)
async function triggerConditionalCreate(abortController) {
  if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
    const capabilities = await PublicKeyCredential.getClientCapabilities();
    if (capabilities.conditionalCreate === true) {
      // Abort ongoing conditional UI form autofill to prevent collisions
      abortController.abort();

      // Notify server this fetch is a conditional-create flow to conditionalize UP
      const creationOptionsJSON = await optionsFetch({ conditional: true });
      const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(creationOptionsJSON);

      let credential;
      try {
        credential = await navigator.credentials.create({ 
          publicKey,
          mediation: 'conditional'
        });
      } catch (e) {
        // Silently swallow expected client WebAuthn exceptions
        if (['InvalidStateError', 'NotAllowedError', 'AbortError'].includes(e.name)) {
          return;
        }
        console.error('Unexpected conditional create error:', e);
        return;
      }

      // Segregated try/catch for Server Sync failures during conditional creation
      let encodedResponse = credential.toJSON();
      try {
        const response = await registerVerifyFetch(encodedResponse);
        if (!response.ok) {
          if (PublicKeyCredential.signalUnknownCredential) {
            await PublicKeyCredential.signalUnknownCredential({
              rpId: window.location.hostname,
              credentialId: encodedResponse.id
            });
          }
        }
      } catch (serverErr) {
        console.error('Conditional server verify network failure:', serverErr);
        if (PublicKeyCredential.signalUnknownCredential) {
          await PublicKeyCredential.signalUnknownCredential({
            rpId: window.location.hostname,
            credentialId: encodedResponse.id
          });
        }
      }
    }
  }
}
```

---

## Fallback Strategies

{{ BASELINE_STATUS("webauthn") }}

Passkey registration is a progressive enhancement. If biometrics or platform authenticators are unsupported by the browser or device:
*   **Fallback Experience**: Gracefully fallback to traditional secure password flows (with optional Multi-Factor authentication) or standard credential fields.
*   **Feature Detection**:
    ```javascript
    if (!window.PublicKeyCredential || !PublicKeyCredential.getClientCapabilities) {
      // Fallback immediately to standard passwords form
      showStandardPasswordFields();
    }
    ```
