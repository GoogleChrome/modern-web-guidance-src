# Expectations for Passkey Management

*   The application fetches user passkey records from the `/api/credentials` endpoint to display in a UI list.
*   The UI displays an explicit empty-state row container and message ("No passkeys found") when the credentials response is empty.
*   The UI row items displays the provider icon AAGUID-derived, provider or customized Name, formatted human-readable timestamps (`registeredAt`, `lastUsedAt`), rename action triggering, and deletion action triggering.
*   The UI AAGUID metadata parser edge cases bypasses and skips registry lookups when encountering the zeroed AAGUID (`00000000-0000-0000-0000-000000000000`).
*   The application invokes `PublicKeyCredential.signalAllAcceptedCredentials` on `DOMContentLoaded` page load event.
*   The application updates and syncs password managers by invoking `PublicKeyCredential.signalAllAcceptedCredentials` immediately following a passkey deletion on the backend.
*   The application updates user vaults UI by invoking `PublicKeyCredential.signalCurrentUserDetails` immediately following a passkey renaming on the backend.
*   The client strictly passes Base64URL-encoded strings for both `userId` and `allAcceptedCredentialIds` to the Signal API, bypassing `Uint8Array` types.
*   The guide documents a `MANDATORY:` warning explaining that passing an empty accepted credential array tells managers to hide all user passkeys.
*   The Fallback strategies lead with the standalone `{{ BASELINE_STATUS("webauthn") }}` macro.
