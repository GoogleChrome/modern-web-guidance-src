---
description: Enable extensions to inject and manage user-provided scripts on web pages with granular control over execution environments and messaging.
filename: user-scripts-api
category: extensions
---

# User Scripts API

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/userScripts

## Best Practices

When developing extensions that require injecting user-provided scripts into web pages, leverage the `chrome.userScripts` API for enhanced control and security.

### Manifest Declaration

Ensure your `manifest.json` includes the `"userScripts"` permission and appropriate `"host_permissions"` for the sites where scripts will run.

```json
{
  "name": "User script extension",
  "manifest_version": 3,
  "minimum_chrome_version": "120",
  "permissions": [
    "userScripts"
  ],
  "host_permissions": [
    "*://example.com/*"
  ]
}
```

### User Consent and Toggles

User scripts require explicit user opt-in beyond the extension's installation. The mechanism for this varies by Chrome version:

-   **Chrome versions prior to 138:** Users must enable **Developer mode** in `chrome://extensions`.
-   **Chrome versions 138 and newer:** Users must enable the **Allow User Scripts** toggle on the extension's details page in `chrome://extensions`.

It is crucial to guide users through these steps, especially during onboarding, to ensure your extension functions correctly.

### API Availability Check

Implement a robust check to determine if the `chrome.userScripts` API is available and enabled by the user. This prevents errors and provides a graceful user experience.

```javascript
function isUserScriptsAvailable() {
  try {
    // A method call that should succeed if the API is available and enabled.
    chrome.userScripts.getScripts();
    return true;
  } catch {
    // API is not available or not enabled.
    return false;
  }
}
```

### Isolated Worlds and Main Worlds

Choose the appropriate execution environment for your user scripts:

-   **`USER_SCRIPT` (Isolated World):** Provides an isolated execution context, preventing interference with the host page or other extensions. This is the recommended default for user scripts.
-   **`MAIN` (Main World):** Scripts run in the same context as the host page's JavaScript. Use with caution.

Configure Content Security Policy (CSP) for `USER_SCRIPT` worlds using `chrome.userScripts.configureWorld()`.

```javascript
chrome.userScripts.configureWorld({
  csp: "script-src 'self'"
});
```

### Messaging

User scripts can communicate with other parts of your extension using the messaging API, but they utilize dedicated event handlers: [`runtime.onUserScriptMessage`](/docs/extensions/reference/api/runtime#event-onUserScriptMessage) and [`runtime.onUserScriptConnect`](/docs/extensions/reference/api/runtime#event-onUserScriptConnect).

Before enabling messaging, configure the world:

```javascript
chrome.userScripts.configureWorld({
  messaging: true
});
```

### Handling Extension Updates

User scripts are cleared upon extension updates. Re-register your scripts within the `runtime.onInstalled` event handler, specifically responding to the `"update"` reason.

## Example: Registering a User Script

The following demonstrates a basic registration of a user script that displays an alert.

```javascript
chrome.userScripts.register([{
  id: 'myUserScript',
  matches: ['*://*/*'], // Matches all URLs
  js: [{code: 'alert("Hello from User Script!");'}]
}]);
```