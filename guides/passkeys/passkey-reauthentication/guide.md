---
name: passkey-reauthentication
description: Verify a signed-in user's identity using their existing passkeys before a sensitive action.
web-feature-ids:
  - webauthn
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
  - https://www.w3.org/TR/webauthn-3/
  - https://web.dev/articles/passkey-form-autofill
---

# Passkey Reauthentication Guide

This delta-focused guide details how to implement step-up authentication or re-verification for a signed-in user before they perform sensitive account changes (e.g. passwords updates, email re-routes, financial transfers).

## Delta Flow Architecture

Unlike discoverable authentication which permits discoverable logins from an empty array, Passkey Reauthentication constrains biometrics dialog prompts strictly to the logged-in user's pre-registered credentials to prevent account-mixing or biometrics spoofing during active sessions.

## Server-Side

### Options Generation Delta

Create a `/reauth/options` endpoint that populates the allowed credentials parameters specifically for the active, known user:

1.  **Constrain Allow Credentials**:
    *   `MANDATORY:` Populate the `allowCredentials` options array with specific `PublicKeyCredentialDescriptor` records mapping all registered passkey IDs for the signed-in user. Leaving this empty or omitting it regresses to discoverable logins, violating session safety.
2.  **Require Biometric Verification**: Set `userVerification: "required"` in the options to ensure the biometric or PIN step cannot be bypassed during sensitive transactions.

```javascript
// Node.js step-up options generation example
router.post('/api/reauth/options', enforceActiveSession, async (req, res) => {
  const userPasskeys = await db.findCredentialsByUserId(req.user.id);
  
  const options = {
    challenge: serverGeneratedBase64UrlChallenge, // Random challenge stored in user session
    rpId: "example.com",
    // Enforce allowance strictly limited to the user's credentials list
    allowCredentials: userPasskeys.map(cred => ({
      type: "public-key",
      id: cred.id,
      transports: cred.transports // Speeds up resolution by indicating platform transports
    })),
    userVerification: "required" // Force biometrics validation
  };
  
  req.session.expectedUserVerification = "required";
  return res.json(options);
});
```

### Verification Endpoint Delta

Verify the returned re-authentication assertion returned by the client:

1.  **Verify Account Ownership**:
    *   `MANDATORY:` The verification endpoint MUST explicitly verify that the resulting authenticated credential ID returned by the client matches one of the pre-registered credential records belonging to the active signed-in user (`SesamePublicKeyCredential.passkeyUserId === req.user.id`). If a valid passkey of a *different* user is returned, authentication MUST be rejected immediately.

## Client-Side Flow Deltas

Applications choose from two reauthentication interfaces depending on the transaction UI:

### A. Button Flow (No Input Fields)

Trigger reauthentication when a user presses a "Verify Identity" or "Proceed with Transaction" button:
*   Follow the standard authentication biometrics prompt triggers.
*   Ongoing form autofills (Conditional Gets) MUST be aborted prior to starting the biometric dialog.

### B. Conditional Mediation Flow (Autofill UI Form)

If the sensitive transaction panel includes a password/re-auth input form (Progressive Step-Up fallback):
*   Follow the Conditional UI Autofill initialization.
*   Annotate the username field with `autocomplete="username webauthn"`.

---

## Fallback Strategies

{{ BASELINE_STATUS("webauthn") }}

Passkey reauthentication is a progressive enhancement. If platform authenticators or biometric devices are unsupported:
*   **Fallback Experience**: Gracefully degrade to standard session reauthentication panels (requiring the user to enter their standard accounts passwords or answer registered security questions).
*   **Feature Detection**:
    ```javascript
    if (!window.PublicKeyCredential || !PublicKeyCredential.getClientCapabilities) {
      // Bypasses passkeys prompts and surfaces traditional password verification panels
      showTraditionalReauthFields();
    }
    ```
