# Passkey Management Implementation

It is best practice to allow users to manage their registered passkeys (list, rename, delete).

## Requirements

- Allow saving multiple passkeys
- Display a registered passkeys list
    - Each passkey item displays:
        - Passkey manager icon (Determine based on the AAGUID)
        - Passkey name (Determine based on the AAGUID)
        - Registered date / time
        - Last used date / time
        - Rename button
        - Delete button
    - Rename a registered passkey
    - Delete a registered passkey
- Create passkey button
- Send list of passkeys signal to password manager as soon as the page is loaded or a passkey is deleted
- Send passkey user details signal to password manager after renaming a passkey

## 1. Server-side Operations

Ensure your `Credentials` store and server endpoints support:
- Returns all credentials for a user.
- Updates an existing credential (for renaming).
- Deletes a credential.

Example endpoints:

```javascript
// GET or POST — return all credentials for the signed-in user
router.post('/credentials', sessionCheck, (req, res) => {
  const credentials = Credentials.findByUserId(res.locals.user.id);
  return res.json(credentials);
});

// PUT — rename a credential
router.put('/credential/:credentialId', sessionCheck, async (req, res) => {
  const { credentialId } = req.params;
  const { name } = req.body;
  const credential = Credentials.findById(credentialId);
  if (!credential || credential.passkeyUserId !== res.locals.user.id) {
    return res.status(404).json({ error: 'Credential not found.' });
  }
  credential.name = name;
  await Credentials.update(credential);
  return res.json(credential);
});

// DELETE — delete a credential
router.delete('/credential/:credentialId', sessionCheck, async (req, res) => {
  const { credentialId } = req.params;
  const credential = Credentials.findById(credentialId);
  if (!credential || credential.passkeyUserId !== res.locals.user.id) {
    return res.status(404).json({ error: 'Credential not found.' });
  }
  await Credentials.delete(credentialId);
  return res.json({ success: true });
});
```

## 2. Client-Side Logic

### Conditional passkey creation button

Display a "Create passkey" button if the browser supports passkeys. Determine the capability using `PublicKeyCredential.getClientCapabilities()`.

### Display the saved passkey list

When rendering the passkeys on the client, ensure each passkey item displays the following:
- **Passkey manager icon**: An icon representing the passkey provider (determine based on the `AAGUID`).
- **Passkey name**: The name of the passkey provider or a custom name (determine based on the `AAGUID`).
- **Registered date / time**: The date and time when the passkey was registered.
- **Last used date / time**: The date and time when the passkey was last used.
- **Rename button**: A UI element allowing the user to rename the passkey.
- **Delete button**: A UI action allowing the user to remove the passkey.

Display "No passkeys found" message when there are no passkeys.

### Signal on page load and after delete

You MUST read [[references/signal-api]] for exact method signatures before implementing any Signal API calls. Key points:
- All `userId` and credential ID parameters are **base64url-encoded strings**, NOT `Uint8Array` or `BufferSource`
- Always feature-detect before calling (e.g. `if (PublicKeyCredential.signalAllAcceptedCredentials)`)

Signal API calls required:
- Call `PublicKeyCredential.signalAllAcceptedCredentials()` as soon as the page is loaded
- Call `PublicKeyCredential.signalAllAcceptedCredentials()` with a list of all saved credentials when a passkey is deleted
- Call `PublicKeyCredential.signalCurrentUserDetails()` with the updated user details after renaming a passkey

## 3. UI Best Practices

- **Empty State**: Show a helpful message if no passkeys are registered.

