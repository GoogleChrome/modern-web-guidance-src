# Expectations for Passkey Registration

*   The application feature detects `passkeyPlatformAuthenticator` support using `PublicKeyCredential.getClientCapabilities()` prior to prompting users.
*   The application triggers options generation from the `/register/options` server endpoint using an action-oriented promo flag parameter.
*   The client decodes option parameters safely using `PublicKeyCredential.parseCreationOptionsFromJSON()`.
*   The client invokes the native biometric creation flow via `navigator.credentials.create()`.
*   The application segregates WebAuthn API exceptions try/catch scopes from server verification fetch errors to avoid signaling safe cancels.
*   The server verification endpoints verify the session challenge, bypasses AAGUID registry mapping for zeroed Authenticator IDs (`00000000-0000-0000-0000-000000000000`), and updates the credential transports persistence list securely.
*   If a server registration verification fetch throws a network exception or fails to return an ok status, `PublicKeyCredential.signalUnknownCredential` is triggered using the Base64URL-encoded credential ID.
*   The Fallback Strategies section leads with `{{ BASELINE_STATUS("webauthn") }}` standalone macro and provides graceful password fallbacks.
