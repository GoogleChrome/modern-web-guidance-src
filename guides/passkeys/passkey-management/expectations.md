# Expectations for Passkey Management

*   The application fetches registered credentials from /api/credentials on load, gracefully bypassing AAGUID provider lookups if zeroed AAGUID is present to render the list correctly.
*   The application automatically invokes signalAllAcceptedCredentials on load via DOMContentLoaded to sync accepted credentials list strings with the password manager.
*   The application updates password managers by immediately calling signalAllAcceptedCredentials within the delete trigger handler upon successful deletions.
*   The application invokes signalCurrentUserDetails within the rename click handler upon successful renames.
*   Each credential row resolved against the AAGUID registry renders both the provider icon and a human-readable last-used timestamp.
*   The "Create Passkey" entry-point button is gated on PublicKeyCredential.getClientCapabilities and hidden when no platform authenticator is available.
