---
description: Manage extension permissions to control access to browser features and data, with clear explanations for users.
filename: extension-permissions
category: extensions
---

# Extension Permissions

Managing permissions is crucial for developing secure and user-friendly Chrome extensions. Permissions define what your extension can access, such as browser tabs, user data, or specific websites. It's essential to declare only the necessary permissions and to consider optional permissions for user control.

## Declaring Permissions

Permissions are declared in the `manifest.json` file using specific keys:

*   `"permissions"`: For a list of known strings that grant access to extension APIs and features. Changes here may trigger warnings.
*   `"optional_permissions"`: Permissions that are granted by the user at runtime, offering more granular control.
*   `"content_scripts.matches"`: Specifies which hosts content scripts can inject into. Changes may trigger warnings.
*   `"host_permissions"`: Grants access to specific hosts. Changes may trigger warnings.
*   `"optional_host_permissions"`: Host permissions that are granted by the user at runtime.

## Manifest Example

Here's an example of how permissions are structured in `manifest.json`:

```json
{
  "name": "Permissions Extension",
  ...
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage"
  ],
  "optional_permissions": [
    "topSites"
  ],
  "host_permissions": [
    "https://www.developer.chrome.com/*"
  ],
  "optional_host_permissions": [
    "https://*/*",
    "http://*/*"
  ],
  ...
  "manifest_version": 3
}
```

## Host Permissions

Host permissions, defined using [match patterns][doc-match], are essential for extensions that need to interact with specific websites or URL schemes. Many Chrome APIs require these permissions in addition to their own API-specific declarations. Examples include:

*   Making [`fetch()`][mdn-fetch] requests.
*   Accessing sensitive [tab properties][api-tabs-tab] like URL and title.
*   Programmatically injecting [content scripts][cs-prog].
*   Monitoring and controlling network requests using [`chrome.webRequest`][api-webrequest].
*   Accessing and managing cookies with [`chrome.cookies`][api-cookies].
*   Redirecting and modifying network requests with [`chrome.declarativeNetRequest`][api-dnr].

## Permissions with Warnings

To enhance user trust and security, extensions often display warnings to users before installation or at runtime, informing them about the permissions being requested. This is particularly important for permissions that grant broad access or could impact user privacy.

![Extension permission warnings on installation](image/extension-permission-warn-0f2793e6ee3c3.png)

To minimize alarming warnings:

*   **Prioritize optional permissions:** Allow users to grant permissions only when needed.
*   **Use less powerful APIs:** If a less privileged API can achieve the same result, opt for it.
*   **Clearly explain permissions:** If warnings are unavoidable, provide clear explanations to users on your extension's store listing or within the extension itself.

Adding or modifying `"host_permissions"` and `"content_scripts.matches"` can also trigger warnings. Refer to [Updating permissions][perm-update] for more details.

## Allowing Access to Specific Environments

For extensions that need to interact with `file://` URLs or operate in incognito mode, users must explicitly grant these permissions.

1.  Right-click the extension icon in Chrome.
2.  Select "Manage Extension."
3.  Scroll down on the extension's details page to find and enable toggles for "Allow access to file URLs" or "Allow in incognito."

You can programmatically check if a user has granted these permissions using:

*   [`extension.isAllowedIncognitoAccess()`][incognito-allow]
*   [`extension.isAllowedFileSchemeAccess()`][file-scheme-allow]

[api-cookies]: /docs/extensions/reference/api/cookies
[api-dnr]: /docs/extensions/reference/api/declarativeNetRequest
[api-perms]: /docs/extensions/reference/api/permissions
[api-ref]: /docs/extensions/reference/api/
[api-storage]: /docs/extensions/reference/api/storage
[api-tabs-tab]: /docs/extensions/reference/api/tabs/#type-Tab
[api-tabs]: /docs/extensions/reference/api/tabs/
[api-webrequest]: /docs/extensions/reference/api/webRequest
[cs-prog]: /docs/extensions/develop/concepts/content-scripts#programmatic
[doc-cs-static]: /docs/extensions/develop/concepts/content-scripts#static-declarative
[doc-manifest]: /docs/extensions/reference/manifest
[doc-match]: /docs/extensions/develop/concepts/match-patterns
[doc-warning]: /docs/extensions/develop/concepts/permission-warnings
[mdn-fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
[perm-update]: /docs/extensions/develop/concepts/permission-warnings#update_permissions
[file-scheme-allow]: /docs/extensions/reference/api/extension/#method-isAllowedFileSchemeAccess
[incognito-allow]: /docs/extensions/reference/api/extension/#method-isAllowedIncognitoAccess