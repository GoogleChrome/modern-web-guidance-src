---
description: Enable seamless transition to passkeys by automatically creating them after password sign-ins with Chrome for Android.
filename: automatic-passkey-creation
category: identity
---

# Automatic Passkey Creation in Chrome for Android

Reference docs:
- https://developer.chrome.com/docs/identity/webauthn-conditional-create
- https://passkeys.dev/device-support/

## Best Practices

To help users transition from passwords to passkeys with less friction, Chrome for Android can automatically create passkeys after a successful password sign-in. Your website can initiate this process by using the WebAuthn API's `Conditional Create` feature. This allows Google Password Manager (GPM) to create a passkey without interrupting the user flow.

When a user signs in with a saved password, your website can request GPM to create a passkey automatically. Chrome handles the eligibility checks. If successful, GPM creates the passkey and returns the credential to your website. Chrome then displays a brief confirmation message with a **Manage** button that opens the new passkey in Google Password Manager settings.

```javascript
// Example of initiating conditional passkey creation after a password sign-in
async function attemptPasskeyCreation(userId) {
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: new Uint8Array(32), // Replace with a proper challenge
        rpId: 'your-relying-party.com', // Replace with your Relying Party ID
        user: {
          id: userId, // Replace with the user's ID
          name: 'user@example.com', // Replace with the user's name
          displayName: 'User Name', // Replace with the user's display name
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -37 }, // EdDSA
          { type: 'public-key', alg: -257 }, // RS256
        ],
        // Crucially, set mediation to 'conditional' for automatic creation
        mediation: 'conditional',
      },
    });

    // Handle the returned credential (e.g., send it to your server)
    console.log('Passkey created:', credential);
  } catch (error) {
    // Handle errors, e.g., user cancellation, feature not supported, etc.
    console.error('Passkey creation failed:', error);
  }
}
```

### User Notification and Control

Chrome displays a clear confirmation message and provides a **Manage** button for the user to access the newly created passkey within Google Password Manager settings. Users also have the ability to disable this automatic creation feature across all their devices via a toggle in their Google Password Manager settings. This setting syncs across devices, ensuring a consistent user experience.

<figure class="screenshot">
  <img src="image/apu-notice.png" style="width:400px" alt="Confirmation message for automatic passkey creation">
  <figcaption>Confirmation message for automatic passkey creation</figcaption>
</figure>

<figure class="screenshot">
  <img src="image/apu-settings.png" style="width:400px" alt="Google Password Manager settings showing a toggle for automatic passkey creation">
  <figcaption>Google Password Manager settings showing a toggle for automatic passkey creation</figcaption>
</figure>

## Compatibility

Automatic passkey creation is supported in Chrome on Android and desktop. Other browsers that support the WebAuthn `mediation: "conditional"` option will also work. You can detect the availability of conditional create using `navigator.credentials.get({ mediation: 'conditional' })` or by checking `getClientCapabilities()`. On Android, Google Password Manager specifically supports this feature.

## Summary

By implementing automatic passkey creation after password sign-in, you can significantly improve the user experience and encourage the adoption of passkeys. Chrome for Android simplifies the process by handling eligibility, creating the passkey in Google Password Manager, and providing users with straightforward options to manage or opt out of the feature.