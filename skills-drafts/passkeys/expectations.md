# Passkey Implementation Expectations

The following assertions define the observable ground-truth behavior of a correctly implemented WebAuthn/Passkey workflow. These criteria are designed to be run against automated Playwright evaluation harnesses.

## 1. Database Persistence Expectations

* The database MUST store the passkey `id` and `credentialPublicKey` as Base64URL-encoded strings.
* The database MUST store the 128-bit `aaguid` identifier.
* The database MUST store the registration timestamp.

## 2. Server-Side Verification Expectations

* The generated authentication `challenge` MUST be temporarily stored in the user session prior to verification.
* The server MUST map existing user credentials to the `excludeCredentials` array during registration attestation to prevent duplicate passkeys.
* The server MUST specify `residentKey: "required"` and `requireResidentKey: true` to mandate discoverable credentials.
* The server MUST selectively ignore User Presence (UP) and User Verification (UV) validation flags during verification if the request was initiated via a silent Conditional Create flow.
* The server MUST populate `allowCredentials` with the user's known `PublicKeyCredentialDescriptor` objects during a re-authentication flow.

## 3. Client-Side Execution Expectations

* The frontend MUST execute a capability check via `PublicKeyCredential.getClientCapabilities()` before rendering any biometric UI.
* The sign-in input fields MUST be annotated with `autocomplete="username webauthn"` to trigger hybrid autofill prompts.
* The `navigator.credentials.get()` API MUST be invoked with `mediation: "conditional"` on load to offer native browser autofill.
* A standard `AbortController` MUST be used to abort ongoing background WebAuthn listeners if the user manually selects password-based sign-in instead.
* The `navigator.credentials.create()` invocation MUST be placed in a separate `try/catch` block from the backend verification `fetch()` request.
* Silent DOM Exceptions (`InvalidStateError`, `NotAllowedError`) MUST be caught and suppressed to prevent visible error modals for background operations.

## 4. Synchronization (Signal API) Expectations

* All `userId` and `credentialId` values passed to the Signal API MUST be Base64URL-encoded strings.
* The `PublicKeyCredential.signalUnknownCredential()` method MUST be invoked only when the backend attestation fetch fails, and MUST NOT be called for generic WebAuthn DOM Exceptions.
* The `PublicKeyCredential.signalAllAcceptedCredentials()` method MUST be invoked automatically on page load and following a credential deletion.
* The `PublicKeyCredential.signalCurrentUserDetails()` method MUST be invoked after the user updates their profile or renames a passkey.
