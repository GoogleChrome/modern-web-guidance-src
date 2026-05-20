Conditional Create allows you to automatically create passkeys for users at the right moment without requiring any action from them, as long as they already have a password saved for your site. This reduces friction in passkey adoption.

This flow works when the user has a saved password in their default password manager, and the password was used recently (e.g., immediately after a successful password-based sign-in).

## Implementation Steps

### 1. Identify the Right Moment
Use Conditional Create **immediately after a successful, full sign-in that involved a password**. If a second factor is required, you must wait until the user has successfully completed all authentication steps and is fully signed in before performing conditional create.

*Note: Passwordless sign-in methods such as magic links, SMS OTP, or identity federation do not meet the conditional create requirements, as it is gated behind entering a valid password.*

### 2. Abort Ongoing Conditional Get
If your login page uses form autofill (Conditional Get), typically the RP expects the user to sign in with either a passkey or password. If the user chooses password, you must abort the ongoing `navigator.credentials.get()` call before invoking an automatic passkey creation.
Use the `AbortController` from your Conditional Get implementation:

```javascript
// Abort the ongoing Conditional Get call
abortController.abort();
```

### 3. Feature Detection
Determine whether Conditional Create is available by checking `conditionalCreate` within `PublicKeyCredential.getClientCapabilities()`.

```javascript
if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
  const capabilities = await PublicKeyCredential.getClientCapabilities();
  if (capabilities.conditionalCreate) {
    // Conditional create is available
  }
}
```

### 4. Create the Passkey Conditionally
Invoke `navigator.credentials.create()` but with `mediation: "conditional"`. 
Ensure you specify `excludeCredentials` to prevent creating duplicate passkeys if one already exists.

```javascript
try {
  const cred = await navigator.credentials.create({
    publicKey: options,
    mediation: 'conditional'
  });
  
  // Send the resulting public key credential to the server to verify and register
} catch (e) {
  // Handle exceptions gracefully
}
```

### 5. Ignore Exceptions Gracefully
If automatic passkey creation fails, the browser handles it silently without triggering visible messages to the user. You must catch and ignore these exceptions to avoid confusing the user with error popups:
- `InvalidStateError`: A passkey already exists in the provider (occurs when `excludeCredentials` is matched).
- `NotAllowedError`: Creating a passkey doesn't meet the required conditions (e.g., password sign-in wasn't recent enough).
- `AbortError`: The WebAuthn call is manually aborted.

### 6. Adjust Server-Side Verification
Make sure the user is already signed in. A passkey created with conditional create can't create a new user.
Since user interaction is skipped, the registration response returns both **User Presence** and **User Verified** as `false`. The server must securely ignore these flags **only** during credential verification for conditional create requests, while continuing to enforce strict presence checks for normal registrations.

### 7. Signal Registration Failures
If the passkey is created by the passkey provider but fails to register on your server, the passkey lists become inconsistent, resulting in failing sign-in attempts for the user. To mitigate this risk, use the Signal API to keep credentials synchronized between the passkey provider and the server.
