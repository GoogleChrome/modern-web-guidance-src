# Expectations for Passkey Reauthentication

*   The application is delta-focused and excludes verbose sign-in error-swallowing or Autofill initialization boilerplates.
*   The options endpoints generations strictly populate `allowCredentials` mapping the pre-registered credential descriptors of the known signed-in user.
*   The creation options enforce user biometrics by specifying `userVerification: "required"`.
*   The client decodes option parameters securely using `PublicKeyCredential.parseRequestOptionsFromJSON()`.
*   The client invokes biometric re-verification via `navigator.credentials.get()`.
*   The server-side verification endpoint explicitly cross-checks and verifies that theReturned credential ID belongs strictly to the currently logged-in `passkeyUserId` database account before authenticating.
*   The Fallback strategies lead with the standalone `{{ BASELINE_STATUS("webauthn") }}` macro.
