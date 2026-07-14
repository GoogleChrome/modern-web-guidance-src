# Passkey Authentication Implementation

Implement a sign-in flow using passkeys.

## 1. Server-Side

### Generate Options Endpoint

1. Create a `challenge` and store it to the session.
2. Specify an empty array `[]` for `allowCredentials` unless the user is known.
3. Specify `userVerification: "preferred"` unless the user explicitly expects `userVerification: "required"`.

### Verify Response Endpoint

1. Check that the `challenge` matches the one in the session.
2. Do not verify the UV flag unless `userVerification: "required"` is passed at the frontend, but don't include this switch in a query parameter. It should be in recorded in the session at the [[#Generate Options Endpoint|options endpoint]].
3. Make sure the signature is verified against the public key stored to the server.
4. Respond with HTTP error code `404` if the matching public key can't be found in the database.

## 2. Client-Side

### Fetch Options from the Server

1. Choose how to invoke passkey authentication:
    1. Trigger authentication when a user presses a "Sign-in with passkey" button. Abort ongoing WebAuthn call if there's one.
    2. Invoke authentication conditionally as soon as the page is loaded if the sign-in utilizes form autofill following [[./references/conditional-mediation]].
2. Perform feature detection with `PublicKeyCredential.getClientCapabilities()` and check with `passkeyPlatformAuthenticator` is supported to ensure the browser and device support passkeys.

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

3. Decode fetched credential JSON object with `PublicKeyCredential.parseRequestOptionsFromJSON()`.
4. Attach `AbortController` in case the authentication request must be terminated.
5. Handle errors from `navigator.credentials.get()` by checking `error.name`:

    ```javascript
    const abortController = new AbortController();
    
    try {
      const credential = await navigator.credentials.get({
        publicKey,
        signal: abortController.signal
      });
      // ... send to server
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        // The user cancelled the dialog or it timed out.
        // Do nothing — allow the user to retry.
      } else if (e.name === 'AbortError') {
        // The operation has been aborted.
      } else {
        // For other errors, the browser typically shows its own error dialog.
      }
    }
    ```

6. Encode the resulting `AuthenticatorAssertionResponse` with `toJSON()` before sending it to the server for verification.
7. Separate the `navigator.credentials.get()` call from the server verification `fetch` call into distinct try/catch blocks (or use a flag/variable to distinguish which phase failed). **Only call `signalUnknownCredential()` when the server explicitly responds with HTTP status `404` (Credential not found).** Do not call it on other server errors to avoid unintentionally signaling a valid passkey as unknown. Do not call it for WebAuthn API errors (`NotAllowedError` and `AbortError`). The credential ID to pass should come from the encoded credential response (e.g. `encodedCredential.id`).
