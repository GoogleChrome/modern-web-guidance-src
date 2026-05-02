# Expectations for Passkey Authentication

*   The HTML sign-in form annotates the username/password input tags with autocomplete tokens space-separated `autocomplete="username webauthn"` and `autofocus`.
*   The client feature detects both `passkeyPlatformAuthenticator` and `conditionalGet` support before initializing Conditional UI.
*   The application registers Conditional UI suggestions automatically on page load (`DOMContentLoaded`) with `mediation: "conditional"`.
*   The client passes an `AbortController` signal to `navigator.credentials.get()` for both autofill and button triggers.
*   The explicit biometrics button click triggers `abortController.abort()` to clear pending autofill suggestions prior to prompting users.
*   The client decodes assertion option JSON parameters using `PublicKeyCredential.parseRequestOptionsFromJSON()`.
*   The client invokes biometric credentials prompting via `navigator.credentials.get()`.
*   The application segregates WebAuthn cancels try/catch scopes from server verification fetch failures.
*   The server-side verification endpoint validates the challenge, securely handles counter mapping passes/saves to database, and establishes the logged-in session upon successful signatures checks.
*   The server verification endpoint returns an explicit HTTP `404` when the credential public key is unknown.
*   If the server verification endpoint returns an explicit HTTP `404` pre-authentication, `PublicKeyCredential.signalUnknownCredential` is invoked passing the Base64URL credential ID.
*   If an explicit button biometrics prompt is cancelled by the user, the client safely re-arms the browser form autofill Conditional UI.
*   The Fallback Strategies section starts with `{{ BASELINE_STATUS("webauthn") }}` macro and provides password degrade instructions.
