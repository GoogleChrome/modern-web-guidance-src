# Expectations for Passkey Conditional Create

*   The application feature-detects capability support checking PublicKeyCredential.getClientCapabilities before starting enrollment.
*   The client invokes AbortController.abort() to cancel any potentially-active conditional-get autofill operation before initiating the silent create call.
*   The client triggers background biometrics creation method passing mediation="conditional".
*   Gating capability support prevents calling the biometrics creation method when conditionalCreate is false.
*   Common WebAuthn exceptions like NotAllowedError are caught and swallowed silently without displaying error messages to the user.
*   If server verification of the credential fails, PublicKeyCredential.signalUnknownCredential is invoked passing the Base64URL credential ID.
