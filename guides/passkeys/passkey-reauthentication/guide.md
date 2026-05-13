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

Unlike discoverable authentication which permits discoverable logins from an empty array, Passkey Reauthentication constrains passkey dialog prompts strictly to the logged-in user's pre-registered credentials to prevent account-mixing or passkey spoofing during active sessions.

## Server-Side

### Options Generation Delta

Create an endpoint that populates the allowed credentials parameters specifically for the active, known user:

**Constrain Allow Credentials**: Populate the `allowCredentials` options array with specific `PublicKeyCredentialDescriptor` records mapping all registered credential IDs for the signed-in user. Leaving this empty or omitting it regresses to discoverable logins, violating session safety.

```javascript
// Node.js step-up options generation example
router.post("/api/reauth/options", enforceActiveSession, async (req, res) => {
  const userPasskeys = await db.findCredentialsByUserId(req.user.id);

  const options = {
    challenge: serverGeneratedBase64UrlChallenge, // Random challenge stored in user session
    rpId: "example.com",
    // Enforce allowance strictly limited to the user's credentials list
    allowCredentials: userPasskeys.map((cred) => ({
      type: "public-key",
      id: cred.id,
      transports: cred.transports, // Speeds up resolution by indicating platform transports
    })),
  };
  return res.json(options);
});
```

### Verification Endpoint Delta

Verify the returned re-authentication assertion returned by the client:

**Verify Account Ownership**: The verification endpoint MUST explicitly verify that the resulting authenticated credential ID returned by the client resolves to a stored credential record whose associated user ID strictly matches the active signed-in user (`storedCredential.passkeyUserId === req.user.id`). If a valid passkey of a _different_ user is returned, authentication MUST be rejected immediately.

## Client-Side Flow Deltas

Applications choose from two reauthentication interfaces depending on the transaction UI:

### A. Button Flow (No Input Fields)

Trigger reauthentication when a user presses a "Verify Identity" or "Proceed with Transaction" button. Ongoing form autofills (Conditional Gets) MUST be aborted prior to starting the passkey dialog.

```html
<button id="reauth-btn" data-testid="reauth-button">Confirm Transaction</button>
```

```javascript
let reauthAbortController = new AbortController();

async function triggerButtonReauth() {
  // Abort any background suggestion flows to avoid passkey prompt collisions
  reauthAbortController.abort();
  reauthAbortController = new AbortController();

  const optionsResponse = await fetch("/api/reauth/options", {
    method: "POST",
  });
  const optionsJSON = await optionsResponse.json();
  const publicKey =
    PublicKeyCredential.parseRequestOptionsFromJSON(optionsJSON);

  try {
    const credential = await navigator.credentials.get({
      publicKey,
      signal: reauthAbortController.signal,
    });

    if (credential) {
      const verifyResponse = await fetch("/api/reauth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential.toJSON()),
      });

      if (verifyResponse.ok) {
        showTransactionSuccessUI();
      }
    }
  } catch (err) {
    if (err.name === "NotAllowedError") {
      console.log("User cancelled reauthentication.");
    }
  }
}

document
  .getElementById("reauth-btn")
  .addEventListener("click", triggerButtonReauth);
```

### B. Conditional Mediation Flow (Autofill UI Form)

If the sensitive transaction panel includes a password/re-auth input form (Progressive Step-Up fallback), you can leverage Conditional UI to allow users to select their pre-registered passkeys directly from browser suggestions:

```html
<form id="reauth-form">
  <!-- Autofill username field annotated with autocomplete token webauthn -->
  <input
    type="text"
    name="username"
    autocomplete="username webauthn"
    autofocus
    data-testid="reauth-username"
  />
  <input type="password" name="password" autocomplete="current-password" />
  <button type="submit">Confirm Password</button>
</form>
```

```javascript
async function initializeConditionalReauth() {
  const capabilities = await PublicKeyCredential.getClientCapabilities();
  if (
    capabilities.passkeyPlatformAuthenticator &&
    capabilities.conditionalGet === true
  ) {
    const optionsResponse = await fetch("/api/reauth/options", {
      method: "POST",
    });
    const optionsJSON = await optionsResponse.json();
    const publicKey =
      PublicKeyCredential.parseRequestOptionsFromJSON(optionsJSON);

    try {
      const credential = await navigator.credentials.get({
        publicKey,
        mediation: "conditional",
        signal: reauthAbortController.signal,
      });

      if (credential) {
        const verifyResponse = await fetch("/api/reauth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credential.toJSON()),
        });

        if (verifyResponse.ok) {
          showTransactionSuccessUI();
        }
      }
    } catch (err) {
      if (!["NotAllowedError", "AbortError"].includes(err.name)) {
        console.error("Unexpected reauth error:", err);
      }
    }
  }
}

window.addEventListener("DOMContentLoaded", initializeConditionalReauth);
```

## Fallback Strategies

### Passkey feature detection fallback

{{ BASELINE_STATUS("webauthn", "api.PublicKeyCredential.getClientCapabilities_static") }}

getClientCapabilities is a progressive enhancement. Install https://github.com/MasterKale/webauthn-polyfills as a polyfill so that `PublicKeyCredential.getClientCapabilities` is always supported.

### Easy JSON Serialization Fallback

{{ BASELINE_STATUS("webauthn", "api.PublicKeyCredential.parseRequestOptionsFromJSON_static") }}

The WebAuthn JSON serialization is a progressive enhancement. Install https://github.com/MasterKale/webauthn-polyfills as a polyfill so that `PublicKeyCredential.parseRequestOptionsFromJSON` and `credential.toJSON` are always supported.
