# Expectations for Passkeys

- The application gates all passkey entry points on a feature detection check (such as `PublicKeyCredential.getClientCapabilities`, `PublicKeyCredential.isConditionalMediationAvailable`, or a `'PublicKeyCredential' in window` check) and hides them when passkeys are unsupported.
- The passkey flows wrap `navigator.credentials` calls in `try/catch` error handling that gracefully catches expected WebAuthn exceptions (such as `NotAllowedError` on user cancellation and `AbortError` on aborted requests) without crashing or surfacing unhandled rejections.
- The client decodes server-provided registration options with `PublicKeyCredential.parseCreationOptionsFromJSON` before invoking `navigator.credentials.create()`.
- The client decodes server-provided authentication options with `PublicKeyCredential.parseRequestOptionsFromJSON` before invoking `navigator.credentials.get()`.
- The WebAuthn options are fetched from a server endpoint rather than constructing the challenge value on the client.
- The Relying Party ID (`rp.id` or `rpId`) used in the WebAuthn options is a bare domain string without a scheme, port, or path that matches the origin's hostname or a registrable parent domain (`eTLD+1` or higher, or `localhost`), and MUST NOT be an IP address or a standalone public suffix (such as `github.io` or `pages.dev`).
- When associating Android apps with the Relying Party ID, the RP ID domain serves a Digital Asset Links JSON array at `/.well-known/assetlinks.json` granting `delegate_permission/common.handle_all_urls` and `delegate_permission/common.get_login_creds` for each target `android_app` (`package_name` and `sha256_cert_fingerprints`).
- When associating iOS or macOS apps with the Relying Party ID, the RP ID domain serves an Apple App Site Association JSON object at `/.well-known/apple-app-site-association` (without a `.json` extension) containing a `webcredentials.apps` array of `<TeamID>.<BundleID>` identifiers.
- When sharing passkeys across distinct registrable domains (`eTLD+1`s), the application uses a single primary RP ID consistently for both registration and authentication and serves a Related Origin Requests JSON object at `/.well-known/webauthn` containing an `origins` array of authorized HTTPS origins.
- The client serializes the returned credential using `PublicKeyCredential.prototype.toJSON` and posts it to a server verification endpoint.
- The application invokes `PublicKeyCredential.signalAllAcceptedCredentials` after credential list changes such as deletion so password managers stay in sync.
- The application invokes `PublicKeyCredential.signalCurrentUserDetails` after the user's username or display name is updated.
- The application invokes `PublicKeyCredential.signalUnknownCredential` when the server reports that an asserted credential is unknown.
- The application uses the credential AAGUID exclusively to render provider names or icons in the UI and MUST NOT use it for authorization or access control decisions.
- The application MUST NOT hand-roll WebAuthn signature verification or challenge validation in client-side JavaScript.
