---
name: passkey-management
description: Let users view and manage the passkeys registered to their account.
web-feature-ids:
  - webauthn
  - webauthn-signals
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
  - https://www.w3.org/TR/webauthn-3/
  - https://raw.githubusercontent.com/passkeydeveloper/passkey-authenticator-aaguids/refs/heads/main/combined_aaguid.json
  - https://web.dev/articles/passkey-management
---

# Passkey Management Guide

This guide details how to enable users to view, rename, and delete their registered passkeys while keeping saved credentials perfectly synchronized between the server and the user's password managers using the Signal API.

## Server-Side Operations

Your backend database layer and endpoints MUST support common CRUD actions for registered credentials. Decoupled from framework-specific libraries, the server exposes endpoints to:

1.  **List all user credentials**: Fetch all `StoredPasskeyCredential` records matching the signed-in user's ID.
2.  **Update credential names**: Accept a new custom string name for a specific credential ID and persist the update.
3.  **Delete credentials**: Remove a specific credential ID from the database.

```javascript
// Node.js routing example for credential CRUD
router.get('/api/credentials', checkUserAuthenticated, async (req, res) => {
  const list = await db.findCredentialsByUserId(req.user.id);
  return res.json(list);
});

router.put('/api/credential/:id', checkUserAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const cred = await db.findCredentialById(id);
  if (!cred || cred.passkeyUserId !== req.user.id) {
    return res.status(404).json({ error: 'Credential not found.' });
  }
  cred.name = name;
  await db.saveCredential(cred);
  return res.json(cred);
});

router.delete('/api/credential/:id', checkUserAuthenticated, async (req, res) => {
  const { id } = req.params;
  const cred = await db.findCredentialById(id);
  if (!cred || cred.passkeyUserId !== req.user.id) {
    return res.status(404).json({ error: 'Credential not found.' });
  }
  await db.deleteCredential(id);
  return res.json({ success: true });
});
```

## Client-Side Management UI

Render a dedicated settings panel allowing users to easily audit and manage their registered authentication options:

1.  **Display saved list**: Fetch list from your GET endpoint and render individual credential rows. If the response is empty, render a helpful empty-state message (e.g., "No passkeys found").
2.  **Map AAGUID Metadata**: For each passkey, lookup its `aaguid` property against your local registry to render its provider details.
    *   *Warning*: Skip registry lookups entirely if the `aaguid` is the zeroed AAGUID (`00000000-0000-0000-0000-000000000000`). Default to browser-agent naming (or "Unknown passkey provider") and set the icon to `undefined`.
3.  **Per-Item UI Requirements**: Every row inside the list container MUST render:
    *   **Provider Icon**: AAGUID-derived image or data URI.
    *   **Provider/Custom Name**: AAGUID-derived name or user-renamed string.
    *   **Registration Date**: The database-persisted raw epoch timestamp `registeredAt` formatted to a human-readable date for client display.
    *   **Last Used Date**: The database-persisted raw epoch timestamp `lastUsedAt` formatted to a human-readable date (if present) for client display.
    *   **Rename Button**: Triggers a rename text input modal.
    *   **Delete Button**: Triggers deletion.
4.  **Conditional "Create Passkey" Button**:
    *   `MANDATORY:` Offer a prominent "Create passkey" registration trigger button on the management page. Before rendering this UI element, the page MUST feature-detect capabilities using `PublicKeyCredential.getClientCapabilities()` to verify platform biometrics exist. If biometrics are unsupported, hide this button and gracefully encourage standard MFA enrollments instead.

## Signal API Synchronization

The Signal API lets the application communicate credential states to password managers, keeping the user's synced vaults and your backend database in lockstep.

*   **Parameter Encoding Rule**:
    *   `MANDATORY:` All `userId` and credential ID parameters passed to Signal API methods (`signalAllAcceptedCredentials`, `signalCurrentUserDetails`) MUST be **Base64URL-encoded strings**. Do NOT pass `Uint8Array` or `BufferSource` objects.
*   **Initiating Page Load Sync**:
    *   `MANDATORY:` The application MUST invoke `signalAllAcceptedCredentials()` automatically in a `DOMContentLoaded` page load event listener, passing the Base64URL UserID and valid credentials list.
*   **Management Updates Sync**:
    *   `MANDATORY:` The application MUST invoke `signalAllAcceptedCredentials()` immediately within your delete credential click handler post-fetch, passing the remaining valid credentials list.
    *   `MANDATORY:` The application MUST invoke `signalCurrentUserDetails()` immediately within your rename click handler post-fetch, passing the updated Name details.
*   **Empty Array Synchronization Warning**:
    *   `MANDATORY:` Passing an empty array `[]` to `signalAllAcceptedCredentials()` tells the password manager to **hide all passkeys** for this user on your site. Only invoke an empty list signal when you are 100% confident that the database contains zero valid passkeys for the user.

```javascript
// Client-side management synchronization ES module
import { listFetch, renameFetch, deleteFetch } from './api.js';

// Base64URL-encoded User ID string (illustration only)
const base64UrlUserId = "M2YPl-KGnA8";

async function syncAcceptedCredentials(currentCredentialsList) {
  if (window.PublicKeyCredential && PublicKeyCredential.signalAllAcceptedCredentials) {
    try {
      const credentialIds = currentCredentialsList.map(c => c.id); // Map of Base64URL credential ID strings
      
      await PublicKeyCredential.signalAllAcceptedCredentials({
        rpId: window.location.hostname,
        userId: base64UrlUserId, // User ID Base64URL-encoded string
        allAcceptedCredentialIds: credentialIds
      });
    } catch (e) {
      console.error('SignalAllAcceptedCredentials sync failure:', e);
    }
  }
}

async function loadManagementPanel() {
  const response = await listFetch();
  const list = await response.json();
  
  renderUI(list);
  // Sync on page load
  await syncAcceptedCredentials(list);
}

async function performDelete(credentialId) {
  const response = await deleteFetch(credentialId);
  if (response.ok) {
    const updatedResponse = await listFetch();
    const updatedList = await updatedResponse.json();
    
    renderUI(updatedList);
    // Sync after deletion
    await syncAcceptedCredentials(updatedList);
  }
}

async function performRename(credentialId, updatedName, updatedDisplayName) {
  const response = await renameFetch(credentialId, { name: updatedName });
  if (response.ok) {
    if (window.PublicKeyCredential && PublicKeyCredential.signalCurrentUserDetails) {
      try {
        await PublicKeyCredential.signalCurrentUserDetails({
          rpId: window.location.hostname,
          userId: base64UrlUserId,
          name: updatedName, // Updated username (email)
          displayName: updatedDisplayName // Updated display name
        });
      } catch (e) {
        console.error('SignalCurrentUserDetails sync failure:', e);
      }
    }
    loadManagementPanel(); // Re-load UI
  }
}
```

---

## Fallback Strategies

{{ BASELINE_STATUS("webauthn") }}

Passkey management is a progressive enhancement. If browser or device environments do not support platform capabilities:
*   **Fallback Experience**: Surface standard profile panels allowing users to manage MFA devices, passwords, or security questions natively.
*   **Feature Detection**:
    ```javascript
    if (!window.PublicKeyCredential || !PublicKeyCredential.getClientCapabilities) {
      // Hide Passkey management UI options and fall back to standard panels
      hidePasskeysSection();
    }
    ```
