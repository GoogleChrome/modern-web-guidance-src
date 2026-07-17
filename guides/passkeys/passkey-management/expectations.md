# Expectations for Passkey Management

*   The application fetches registered credentials from the credential endpoint on load.
*   The application automatically invokes signalAllAcceptedCredentials on load via DOMContentLoaded to sync accepted credentials list strings with the password manager.
*   The application updates passkey providers by immediately calling signalAllAcceptedCredentials within the delete trigger handler upon successful deletions.
*   The application invokes signalCurrentUserDetails within the rename click handler upon successful username or display name rename.
*   Each credential row resolved against the AAGUID registry renders info such as the provider icon, name and a human-readable last-used timestamp.
*   The "Create Passkey" entry-point button is gated on PublicKeyCredential.getClientCapabilities and hidden when passkey is unsupported.
