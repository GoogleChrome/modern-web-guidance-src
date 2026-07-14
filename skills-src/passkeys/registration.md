# Passkey Registration Implementation

Rely on a Passkey/WebAuthn/FIDO2 library that suit your server language.

## 1. Database Requirements

Your database should store:

```typescript
export interface SesamePublicKeyCredential {
  id: Base64URLString; // Credential ID
  passkeyUserId: PasskeyUserId; // User ID for passkeys
  credentialPublicKey: Base64URLString; // public key,
  credentialType: string; // type of credential,
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  aaguid: string; // AAGUID,
  counter?: number // Optional counter
  providerIcon: string; // Provider icon determined based on AAGUID
  name: string; // Determined based on AAGUID
  transports: AuthenticatorTransportFuture[]; // list of transports,
  lastUsedAt?: number; // last used epoc time,
  registeredAt: number;
}
```

## 2. Server-Side

### Generate Options Endpoint

1. Create a `challenge` and store it to the session.
2. Pass existing credentials to `excludeCredentials` to prevent creating duplicates on the same password manager account.
3. **`authenticatorAttachment` depends on the call site — this is a common mistake:**
   - Set `authenticatorAttachment: "platform"` **only** for **passkey promotion** flows: post-signup auto-creation, post-login prompt, or any fire-and-forget passkey offer. "Passkey promotion" means offering passkey creation to a user who just authenticated via a non-passkey method.
   - **Do NOT set `authenticatorAttachment`** (omit it entirely) when called from a **dedicated passkey management page** (e.g. Settings → Security). Omitting it allows users to register hardware security keys (YubiKey, etc.) in addition to platform authenticators.
   - If a single `/register/options` endpoint serves both flows, accept a `promotion: boolean` field in the request body and conditionally apply `authenticatorAttachment: "platform"` only when `promotion === true`.
4. Specify `requireResidentKey: true` and `residentKey: "required"` to request a discoverable credential.
5. Specify `userVerification: "preferred"` or `userVerification: "required"` to verify the user.

### Verify Response Endpoint

1. Check that the `challenge` matches the one in the session.
2. Accept a UV flag: `false` (if you used `'preferred'` and want to allow UV-less authenticators, though mostly unnecessary for resident keys).
3. The UP flag must be `true` unless this is conditional create.
4. Determine the passkey provider based on the AAGUID. You must read [[./references/determine-passkey-provider-from-aaguid]] .
5. Respond with HTTP error code 404 if the matching public key can't be found in the database so that the frontend can invoke the Signal API.

## 3. Client-Side Logic

### Fetch Options from the Server

1. Perform feature detection with `PublicKeyCredential.getClientCapabilities()` to ensure the browser and device support passkeys. Namely:
    - a platform authenticator
    ```javascript
      // Check for compatibility
      if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
        const capabilities = await PublicKeyCredential.getClientCapabilities();
        if (!capabilities.passkeyPlatformAuthenticator) {
          // Platform authenticator is not available.
          return;
        }
      }
    ```
2. Decode fetched credential JSON object with `PublicKeyCredential.parseCreationOptionsFromJSON()`.
3. Handle errors from `navigator.credentials.create()` by checking `error.name`:
    ```javascript
    try {
      const credential = await navigator.credentials.create({ publicKey });
      // ... send to server
    } catch (e) {
      if (e.name === 'InvalidStateError') {
        // A matching credential already exists in the authenticator.
        // Inform the user a passkey already exists for this device.
      } else if (e.name === 'SecurityError') {
        // The RP ID doesn't match the origin, or the page isn't HTTPS.
        // Show an error message — this is a configuration problem.
      } else if (e.name === 'NotAllowedError') {
        // The user cancelled the dialog or it timed out.
        // Do nothing — allow the user to retry.
      } else if (e.name === 'AbortError') {
        // The operation has been aborted.
      }
      // For other errors, the browser typically shows its own error dialog.
    }
    ```
4. Encode the resulting `AuthenticatorAttestationResponse` with `toJSON()` before sending it to the server for verification.
5. Separate the `navigator.credentials.create()` call from the server verification `fetch` call into distinct try/catch blocks (or use a flag/variable to distinguish which phase failed). Only call `signalUnknownCredential()` when the server verification fails — i.e., when the `fetch()` throws. The credential ID to pass should come from the encoded credential response (e.g. `encodedCredential.id`). Do not call it for WebAuthn API errors (`InvalidStateError`, `NotAllowedError`,` SecurityError` and `AbortError`).


