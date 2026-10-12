# Expectations for Passkeys

- The application gates all passkey entry points on a feature detection check (such as `PublicKeyCredential.getClientCapabilities`, `PublicKeyCredential.isConditionalMediationAvailable`, or a `'PublicKeyCredential' in window` check) and hides them when passkeys are unsupported.
- The passkey flows wrap `navigator.credentials` calls in `try/catch` error handling that gracefully catches expected WebAuthn exceptions (such as `NotAllowedError` on user cancellation and `AbortError` on aborted requests) without crashing or surfacing unhandled rejections.
- The client decodes server-provided registration options with `PublicKeyCredential.parseCreationOptionsFromJSON` before invoking `navigator.credentials.create()`.
- The client decodes server-provided authentication options with `PublicKeyCredential.parseRequestOptionsFromJSON` before invoking `navigator.credentials.get()`.
- The WebAuthn options are fetched from a server endpoint rather than constructing the challenge value on the client.
- The Relying Party ID (`rp.id` or `rpId`) used in the WebAuthn options is a bare domain string without a scheme, port, or path that matches the origin's hostname or a registrable parent domain (`eTLD+1` or higher, or `localhost`), and MUST NOT be an IP address or a standalone public suffix (such as `github.io` or `pages.dev`).
- The client serializes the returned credential using `PublicKeyCredential.prototype.toJSON` and posts it to a server verification endpoint.
- The application invokes `PublicKeyCredential.signalAllAcceptedCredentials` after credential list changes such as deletion so password managers stay in sync.
- The application invokes `PublicKeyCredential.signalCurrentUserDetails` after the user's username or display name is updated.
- The application invokes `PublicKeyCredential.signalUnknownCredential` when the server reports that an asserted credential is unknown.
- The application uses the credential AAGUID exclusively to render provider names or icons in the UI and MUST NOT use it for authorization or access control decisions.
- The application MUST NOT hand-roll WebAuthn signature verification or challenge validation in client-side JavaScript.
