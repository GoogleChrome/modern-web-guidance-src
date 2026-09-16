# Expectations for Passkeys

*   The application gates all passkey entry points on a feature detection check (such as `PublicKeyCredential.getClientCapabilities`, `PublicKeyCredential.isConditionalMediationAvailable`, or a `'PublicKeyCredential' in window` check) and hides them when passkeys are unsupported.
*   The client calls the native `navigator.credentials.create()` API directly for passkey registration rather than a third-party library wrapper such as SimpleWebAuthn's `startRegistration`.
*   The client calls the native `navigator.credentials.get()` API directly for passkey authentication rather than a third-party library wrapper such as SimpleWebAuthn's `startAuthentication`.
*   The client decodes server-provided registration options with `PublicKeyCredential.parseCreationOptionsFromJSON` before invoking `navigator.credentials.create()`.
*   The client decodes server-provided authentication options with `PublicKeyCredential.parseRequestOptionsFromJSON` before invoking `navigator.credentials.get()`.
*   The WebAuthn options are fetched from a server endpoint rather than constructing the challenge value on the client.
*   The Relying Party ID used in the WebAuthn options matches or is a registrable suffix of the application's own origin hostname.
*   The client serializes the returned credential using `PublicKeyCredential.prototype.toJSON` (or an equivalent base64url encoding) and posts it to a server verification endpoint.
*   The application invokes `PublicKeyCredential.signalAllAcceptedCredentials` after credential list changes such as deletion so password managers stay in sync.
*   The application invokes `PublicKeyCredential.signalCurrentUserDetails` after the user's username or display name is updated.
*   The application invokes `PublicKeyCredential.signalUnknownCredential` when the server reports that an asserted credential is unknown.
*   The passkey flows wrap `navigator.credentials` calls in error handling that distinguishes user cancellation (`NotAllowedError`) from other failures and surfaces a visible status message.
*   The application uses the credential AAGUID exclusively to render provider names or icons in the UI and MUST NOT use it for authorization or access control decisions.
*   The application MUST NOT hand-roll WebAuthn signature verification or challenge validation in client-side JavaScript.
