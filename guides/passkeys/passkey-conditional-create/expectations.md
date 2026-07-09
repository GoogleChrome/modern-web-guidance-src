# Expectations for Passkey Conditional Create

*   The implementation MUST load a webauthn-polyfills library. 
*   The application feature-detects capability support checking PublicKeyCredential.getClientCapabilities before starting enrollment.
*   The client invokes AbortController.abort() to cancel any potentially-active conditional-get autofill operation before initiating the silent create call.
*   The client triggers background passkey creation method passing mediation="conditional".
*   Common WebAuthn exceptions like NotAllowedError are caught and swallowed silently without displaying error messages to the user.
*   If server verification of the credential fails, PublicKeyCredential.signalUnknownCredential is invoked.
