---
description: Authenticate users with Google OAuth2 to access Google People API data in Chrome extensions.
filename: oauth-chrome-extension
category: extensions
---

# OAuth2: Authenticate users with Google

Reference docs:
- [OAuth2][1]
- [Chrome Identity API][3]
- [Google People API][2]

## Best Practices

To authenticate users with Google OAuth2 and access their data via the Google People API within a Chrome extension, follow these best practices:

1.  **Manifest Configuration:**
    *   Declare the `"identity"` permission in your `manifest.json` file to enable the `chrome.identity` API.
    *   Configure the `"oauth2"` field in your manifest, specifying your OAuth client ID obtained from the Google API Console and the necessary `"scopes"` for the APIs you intend to access (e.g., `"https://www.googleapis.com/auth/contacts.readonly"` for the People API).
    *   To ensure a consistent extension ID, which is crucial for API registration, upload your extension to the Chrome Developer Dashboard, obtain the public key, and add it to the `"key"` field in your `manifest.json`.

2.  **OAuth Flow Implementation:**
    *   Use `chrome.identity.getAuthToken({interactive: true}, callback)` to initiate the OAuth flow. This will prompt the user to grant permissions if they haven't already.
    *   The callback function receives an authentication `token` that can be used to make authorized API requests.

3.  **API Integration:**
    *   When making requests to Google APIs (like the People API), include the obtained `token` in the `Authorization` header as a Bearer token (e.g., `Authorization: 'Bearer ' + token`).
    *   Ensure your `manifest.json` includes the correct scopes for the APIs you are using.

4.  **Extension ID Consistency:**
    *   Generate your OAuth Client ID in the Google API Console specifically for a "Chrome App," using your extension's unique ID.
    *   Maintaining a consistent extension ID across development and deployment is vital for correct API authorization. Uploading the extension to the developer dashboard and including the `"key"` in the manifest helps achieve this.

5.  **Error Handling:**
    *   Implement robust error handling for `chrome.identity.getAuthToken` and all API fetch requests. This includes checking for token retrieval errors and handling API response errors gracefully.

## Fallback Strategies

While the core Chrome Identity API and OAuth2 flow are standard, consider the following for robustness:

*   **Deprecated Manifest V2:** The provided tutorial uses Manifest V2, which is deprecated. **Always prioritize using Manifest V3** for new extensions and migrate existing ones. Refer to the [Manifest V3 Migration guide][14] for details. The concepts of OAuth2 and using the Chrome Identity API remain similar, but the implementation details within the manifest and background scripts may differ.

*   **API Key Management:** For APIs that require an API key in addition to OAuth, ensure you securely manage and use the API key. For the People API example, the API key is included in the fetch URL.

---

[1]: https://oauth.net/2/
[2]: https://developers.google.com/people/
[3]: https://developers.google.com/identity
[4]: examples/tutorials/oauth_tutorial_complete.zip
[5]: examples/tutorials/oauth_starter/manifest.json
[6]: examples/tutorials/oauth_starter/background.js
[7]: examples/tutorials/oauth_starter/index.html
[8]: https://chrome.google.com/webstore/developer/dashboard
[9]: /docs/extensions/mv2/manifest/key
[10]: https://console.developers.google.com/apis
[11]: https://developers.google.com/identity
[12]: examples/tutorials/oauth_starter/oauth.js
[13]: https://developers.google.com/people/
[14]: /docs/extensions/develop/migrate