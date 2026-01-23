---
description: Provide users with a clear and intuitive interface to manage their passkeys, enhancing security and user experience.
filename: passkey-management-ui
category: security
---

# Passkey Management

Reference docs:
- [Passkeys user journeys](https://developers.google.com/identity/passkeys/ux/user-journeys)
- [Communicating passkeys to users](https://developers.google.com/identity/passkeys/ux/communicating-passkeys)
- [Passkeys user interface design](https://developers.google.com/identity/passkeys/ux/user-interface-design)
- [User authentication with passkeys](https://developer.android.com/design/ui/mobile/guides/patterns/passkeys)

## Best Practices

To effectively manage passkeys, users should be able to:

*   **Add multiple passkeys**: Allow users to register several passkeys, ideally from different providers, to prevent account lockouts if one provider becomes inaccessible. However, prevent multiple passkeys for the same account from the same provider.
*   **View registered passkeys**: Display a clear list of all registered passkeys with essential details for easy identification and management.
*   **Delete passkeys**: Provide an straightforward option for users to remove passkeys, especially when switching devices or if an account has been compromised.
*   **Edit passkey names**: Allow users to rename passkeys for better organization, particularly when managing multiple passkeys for different accounts on the same provider.
*   **Create new passkeys**: Offer a dedicated passkey management screen as a central hub for users to create, delete, and manage their passkeys.

When displaying registered passkeys, include the following details:

*   **Passkey name**: The name given at registration, ideally matching the provider or device.
*   **Passkey provider logo**: Helps users visually identify the passkey.
*   **Creation and last used timestamps**: Aids in identifying specific passkeys.
*   **Sync indicator**: Clearly show if a passkey is synced or non-synced to manage user expectations.
*   **Delete button**: A clear call to action for removing a passkey.
*   **Edit button**: For renaming passkeys.
*   **Last sign-in details (optional)**: Browser, OS, or IP address can help users spot suspicious activity.

## Important Considerations

### Deleting Passkeys

*   **Signal updated list**: When a passkey is deleted from the server, ensure the passkey provider is also updated to avoid user confusion. If the Signal API is not supported, guide users to manually delete from their provider.
*   **Delete last passkey**: Inform users if they are deleting their last passkey for an account. Provide clear instructions on how to sign in next time and offer a chance to collect feedback on their passkey usage.

### Creating Passkeys

*   **Centralized management**: A dedicated passkey management screen is the ideal location for creating new passkeys.
*   **Hardware security tokens**: Consider allowing users to create passkeys on hardware security tokens for advanced security and flexibility. This can be achieved by leaving `authenticatorSelection.authenticatorAttachment` unset during creation requests.

## Checklist

*   [ ] Users can manage passkeys in a dedicated passkey management page.
*   [ ] Support for registering multiple passkeys per account from different providers.
*   [ ] Users can add new passkeys and manage existing ones on the management page.
*   [ ] Display the passkey name clearly.
*   [ ] Indicate whether a passkey is syncable or non-syncable.
*   [ ] Allow users to remove a public key from the server.
*   [ ] Signal the updated list of passkeys to the provider when a public key is removed from the server.
*   [ ] Provide clear warnings and guidance when a user attempts to delete their last passkey.
*   [ ] Offer the option to create passkeys on hardware security tokens.