---
name: passkey-management
description: Let users view and manage the passkeys registered to their account.
web-feature-ids:
  - webauthn
  - webauthn-signals
---

# Passkey Management

This guide details how to enable users to view, rename, and delete their registered passkeys while keeping saved credentials and user profile details synchronized between the server and the user's password managers using the Signal API.

## Server-Side Operations

Your backend database layer and endpoints MUST support common CRUD actions for registered credentials as well as updating user profile details. Decoupled from framework-specific libraries, the server exposes endpoints to:

1.  **List all user credentials**: Fetch all `StoredPasskeyCredential` records matching the signed-in user's ID.
2.  **Update credential names**: Accept a new custom nickname for a specific credential ID and persist the update on the server.
3.  **Delete credentials**: Remove a specific credential ID from the database.
4.  **Update user account details**: Accept updated `name` (username) and `displayName` values for the signed-in user's profile so the client can synchronize them with the passkey provider.

```javascript
// Node.js routing example for credential CRUD and user profile rename
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

router.put('/api/user', checkUserAuthenticated, async (req, res) => {
  const { name, displayName } = req.body;
  const updatedUser = await db.updateUser(req.user.id, { name, displayName });
  return res.json(updatedUser);
});
```

## Client-Side Management UI

Render a dedicated settings panel allowing users to easily audit and manage their registered authentication options and account profile details:

1.  **Display saved list**: Fetch list from your endpoint and render individual credential rows. If the response is empty, render a helpful empty-state message (e.g., "No passkeys found").
2.  **Map AAGUID Metadata**: For each passkey, lookup its `aaguid` property against your local registry to render its provider details. See [Determine the passkey provider from AAGUID](#aaguid) section for more details.
3.  **Per-Item UI Requirements**: Every row inside the list container MUST render:
    *   **Provider Icon**: AAGUID-derived image or data URI.
    *   **Provider/Custom Name**: AAGUID-derived name or user-renamed string.
    *   **Registration Date**: The database-persisted raw epoch timestamp `registeredAt` formatted to a human-readable date for client display.
    *   **Last Used Date**: The database-persisted raw epoch timestamp `lastUsedAt` formatted to a human-readable date (if present) for client display.
    *   **Rename Button**: Triggers a rename action to update the credential's custom nickname on the server (`PUT /api/credential/:id`). Note: Renaming an individual passkey's nickname is a server-side label change and does NOT invoke `signalCurrentUserDetails()`.
    *   **Delete Button**: Triggers deletion of the credential (`DELETE /api/credential/:id`) and synchronizes the remaining credential IDs via `signalAllAcceptedCredentials()`.
4.  **User Account Rename UI**:
    *   Provide a control allowing the user to update their account username (`name`) or `displayName` (`PUT /api/user`), and immediately synchronize the updated user details with the password manager via `PublicKeyCredential.signalCurrentUserDetails()`.
5.  **Conditional "Create Passkey" Button**:
    *   Offer a prominent "Create passkey" registration trigger button on the management page. Before rendering this UI element, the page MUST feature-detect capabilities using `PublicKeyCredential.getClientCapabilities()` to verify platform authenticator is supported. If passkeys are unsupported, hide this button and gracefully encourage standard MFA enrollments instead.
    *   Allow registering a security key by omitting `authenticatorSelection.authenticatorAttachment` on `navigator.credentials.create()` call.

## Signal API Synchronization

The Signal API lets the application communicate credential states to password managers, keeping the user's synced vaults and your backend database in lockstep.

*   **Feature Detection & Parameter Encoding Rule**:
    *   Always feature-detect Signal API methods before invoking them (`if (PublicKeyCredential.signalAllAcceptedCredentials)` and `if (PublicKeyCredential.signalCurrentUserDetails)`).
    *   All `userId` and credential ID parameters passed to Signal API methods (`signalAllAcceptedCredentials`, `signalCurrentUserDetails`) MUST be **Base64URL-encoded strings**.
*   **Initiating Page Load Sync**:
    *   The application MUST invoke `signalAllAcceptedCredentials()` automatically when the management page loads (for example, inside a `DOMContentLoaded` event listener, module initialization, or framework component mount hook such as `useEffect`).
*   **Management Updates Sync**:
    *   The application MUST invoke `signalAllAcceptedCredentials()` immediately within your delete credential click handler post-fetch.
    *   The application MUST invoke `signalCurrentUserDetails()` immediately within your user account rename (`name` or `displayName`) click handler post-fetch.

```javascript
// Client-side management synchronization ES module
import { listFetch, renameCredentialFetch, updateUserFetch, deleteFetch } from './api.js';

// Base64URL-encoded User ID string (illustration only)
const base64UrlUserId = "M2YPl-KGnA8";

async function syncAcceptedCredentials(currentCredentialsList) {
  if (!window.PublicKeyCredential || !PublicKeyCredential.signalAllAcceptedCredentials) return;
  try {
    const credentialIds = currentCredentialsList.map(c => c.id); // Array of Base64URL credential ID strings
    
    await PublicKeyCredential.signalAllAcceptedCredentials({
      rpId, // RP ID must match the one defined on the server
      userId: base64UrlUserId, // User ID Base64URL-encoded string
      allAcceptedCredentialIds: credentialIds
    });
  } catch (e) {
    console.error('SignalAllAcceptedCredentials sync failure:', e);
  }
}

async function loadManagementPanel() {
  const response = await listFetch();
  const list = await response.json();
  
  renderUI(list);
  // Sync accepted credentials on initial load
  await syncAcceptedCredentials(list);
}

async function performDelete(credentialId) {
  const response = await deleteFetch(credentialId);
  if (response.ok) {
    const updatedResponse = await listFetch();
    const updatedList = await updatedResponse.json();
    
    renderUI(updatedList);
    // Sync remaining accepted credentials after deletion
    await syncAcceptedCredentials(updatedList);
  }
}

// Renaming a passkey's nickname updates the server record only
async function performCredentialRename(credentialId, newCredentialName) {
  const response = await renameCredentialFetch(credentialId, { name: newCredentialName });
  if (response.ok) {
    const updatedResponse = await listFetch();
    renderUI(await updatedResponse.json());
  }
}

// Renaming the user's account username or displayName triggers signalCurrentUserDetails
async function performUserRename(rpId, userId, updatedName, updatedDisplayName) {
  const response = await updateUserFetch({ name: updatedName, displayName: updatedDisplayName });
  if (response.ok && window.PublicKeyCredential && PublicKeyCredential.signalCurrentUserDetails) {
    try {
      await PublicKeyCredential.signalCurrentUserDetails({
        rpId, // RP ID must match the one defined on the server
        userId, // Base64URL-encoded user ID
        name: updatedName, // Updated username
        displayName: updatedDisplayName // Updated display name
      });
    } catch (e) {
      console.error('SignalCurrentUserDetails sync failure:', e);
    }
  }
}

window.addEventListener('DOMContentLoaded', loadManagementPanel);
```

## Determine the passkey provider from AAGUID {: #aaguid }

An AAGUID (Authenticator Attestation Globally Unique Identifier) is a 128-bit identifier that represents the model of the authenticator, not a specific instance. It is included in the authenticator data during passkey registration and can be used to determine which passkey provider (e.g. Google Password Manager, iCloud Keychain, 1Password) created a credential.

AAGUID should only be used to help users with passkey management. It can be modified unless cryptographically attested, which platform passkeys currently don't support.

### 1. AAGUID Registry

A community-maintained JSON mapping of AAGUIDs to provider names and icons is available at:

```
https://raw.githubusercontent.com/passkeydeveloper/passkey-authenticator-aaguids/refs/heads/main/combined_aaguid.json
```

Each entry has the following schema:

```json
{
  "<aaguid-uuid>": {
    "name": "Provider Name",
    "icon_light": "data:image/png;base64,...",
    "icon_dark": "data:image/png;base64,..."
  }
}
```

### 2. Using AAGUID After Registration

After verifying a registration response, read the `aaguid` from the registration result and look it up against the registry to populate the credential's `name` and `providerIcon`:

Before looking up the AAGUID in the registry, check if it equals `'00000000-0000-0000-0000-000000000000'`. If so, skip the registry lookup and set `name` to a fallback (e.g. device name from user-agent, or "Unknown passkey provider") and `providerIcon` to `undefined`. Only look up the registry for non-zeroed AAGUIDs.

```javascript
import aaguids from './aaguids.json' with { type: 'json' };

const { aaguid } = registrationInfo;
if (aaguid === '00000000-0000-0000-0000-000000000000') {
  // use the device name as the passkey provider based on
  // the information derived from the user agent string,
  // or just say "Unknown passkey provider"
} else {
  const provider = aaguids[aaguid];
  const credential = {
    // ...other fields
    aaguid,
    name: provider?.name || 'Unknown passkey provider',
    providerIcon: provider?.icon_light,
  };
}
```

## Fallback Strategies

### Passkey feature detection fallback

{{ BASELINE_STATUS("webauthn", "api.PublicKeyCredential.getClientCapabilities_static") }}

Always install 'webauthn-polyfills' and import it in the context.
Consider as long as  `PublicKeyCredential` is supported, `PublicKeyCredential.getClientCapabilities` is also supported. 

```js 
import 'webauthn-polyfills';
``` 

### Signal API Synchronization Fallback

{{ BASELINE_STATUS("webauthn-signals") }}
If the browser does not support `PublicKeyCredential.parseRequestOptionsFromJSON`, use the 'webauthn-polyfills': 
  
```html 
<script type="module"> 
  if (!PublicKeyCredential.parseRequestOptionsFromJSON) { 
     await import('https://unpkg.com/webauthn-polyfills'); 
   } 
 </script> 
 ``` 

This will also add support for `PublicKeyCredential.prototype.toJSON`.

