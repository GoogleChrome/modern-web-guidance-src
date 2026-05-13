# Signal API

The Signal API lets relying parties communicate credential state to passkey providers (password managers), keeping passkeys in sync without user interaction.

Always feature-detect before calling any signal method:

```javascript
if (PublicKeyCredential.signalMethodName) {
  await PublicKeyCredential.signalMethodName({ /* ... */ });
}
```

## 1. `signalAllAcceptedCredentials()`

Informs the passkey provider of the complete list of valid credential IDs for a user. Passkeys not in the list are hidden (not permanently deleted), allowing restoration if they are included in a future call.

**When to call:**
- As soon as the passkey management page loads
- After a passkey is deleted

**Warning:** Passing an empty `allAcceptedCredentialIds` array hides all passkeys for the user. Only invoke when you are confident the list is complete.

```javascript
await PublicKeyCredential.signalAllAcceptedCredentials({
  rpId: "example.com",
  // Pass in a Base64URL-encoded user ID
  userId: "M2YPl-KGnA8",
  allAcceptedCredentialIds: [
    // Pass in a Base64URL-encoded credential IDs
    "vI0qOggiE3OT01ZRWBYz5l4MEgU0c7PmAA",
  ],
});
```

## 2. `signalCurrentUserDetails()`

Synchronizes updated username and display name with the passkey provider. The provider may choose not to overwrite values the user has manually edited in their password manager.

**When to call:**
- After the user updates their profile (username or display name)
- Optionally on every sign-in

```javascript
await PublicKeyCredential.signalCurrentUserDetails({
  rpId: "example.com",
  // Base64URL-encoded user ID
  userId: "M2YPl-KGnA8",
  // username
  name: "new.email@example.com",
  // display name
  displayName: "J. Doe",
});
```

## 3. `signalUnknownCredential()`

Notifies the passkey provider that a credential no longer exists on the server, so the provider can stop offering it to the user.

**When to call:**
- After passkey **authentication** fails because the credential is not found on the server (HTTP 404) — only when the user is unauthenticated.
- After server-side **registration** verification fails — call regardless of auth state.

```javascript
await PublicKeyCredential.signalUnknownCredential({
  rpId: "example.com",
  // Base64URL-encoded credential ID
  credentialId: "vI0qOggiE3OT01ZRWBYz5l4MEgU0c7PmAA",
});
```
