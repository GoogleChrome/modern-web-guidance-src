---
name: authenticate-users
description: Authenticate users with Google accounts or third-party OAuth providers using chrome.identity.
web-feature-ids: []
---

# Authenticate Users

The `chrome.identity` API handles OAuth 2.0 flows for extensions. For Google sign-in, it integrates with the browser's built-in account — no popup windows needed. For third-party providers, it opens a managed auth window and captures the redirect.

## Manifest setup

```json
{
  "permissions": ["identity"],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ]
  }
}
```

## Google sign-in

```js
// Get an OAuth token (Chrome 116+)
async function signIn() {
  const { token } = await chrome.identity.getAuthToken({ interactive: true });
  return token;
}

// Fetch user profile
async function getUserProfile(token) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch profile');
  return response.json();
  // Returns: { sub, name, given_name, family_name, picture, email, email_verified }
}

// Sign out
async function signOut(token) {
  await chrome.identity.removeCachedAuthToken({ token });
  // Optionally revoke server-side
  await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
}
```

## Error handling

```js
try {
  const { token } = await chrome.identity.getAuthToken({ interactive: true });
  const profile = await getUserProfile(token);
} catch (err) {
  if (err.message.includes('canceled')) {
    showMessage('Sign-in was cancelled');
  } else if (err.message.includes('not granted')) {
    showMessage('Permission was denied');
  } else {
    showMessage('Sign-in failed: ' + err.message);
  }
}
```

## CRITICAL: Extension ID changes between development and production

The OAuth `client_id` is tied to a specific extension ID. The ID differs between development (unpacked) and production (Chrome Web Store):

| Context | How ID is determined |
|---------|---------------------|
| Unpacked (development) | Derived from directory path — changes if you move the folder |
| Packed (.crx) | Derived from the private key |
| Chrome Web Store | Assigned by the store — permanent |

To stabilize the ID during development so OAuth works locally:
1. In `chrome://extensions`, click "Pack Extension" to generate a `.crx` and a `.pem` key
2. Open the `.crx` as a ZIP, extract `key` from its `manifest.json`
3. Add that key to your development `manifest.json`:

```json
{
  "key": "MIIBIjANBgkqhk...your-public-key-here...",
  "manifest_version": 3,
  "name": "My Extension"
}
```

Always remind users: after publishing to the Chrome Web Store, update the OAuth client configuration with the store-assigned extension ID.

## Non-Google OAuth (GitHub, Twitter, etc.)

For third-party providers, use `launchWebAuthFlow`:

```js
const redirectUrl = chrome.identity.getRedirectURL();
// Returns: https://<extension-id>.chromiumapp.org/

// GitHub example
const authUrl = new URL('https://github.com/login/oauth/authorize');
authUrl.searchParams.set('client_id', 'YOUR_GITHUB_CLIENT_ID');
authUrl.searchParams.set('redirect_uri', redirectUrl);
authUrl.searchParams.set('scope', 'read:user');

const responseUrl = await chrome.identity.launchWebAuthFlow({
  url: authUrl.toString(),
  interactive: true
});

// Extract the authorization code from the redirect URL
const code = new URL(responseUrl).searchParams.get('code');
// Exchange `code` for an access token via your backend
```

## Setting up Google Cloud Console

1. Go to console.cloud.google.com
2. Create or select a project
3. Enable the APIs you need (e.g., Google People API)
4. Create OAuth 2.0 credentials → select "Chrome Extension" type
5. Set the Application ID to your extension's ID (from `chrome://extensions`)
6. Copy the `client_id` to your `manifest.json`
