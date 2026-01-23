---
description: Detect when a user is idle or active to save resources or change application behavior.
filename: user-idle-detection.md
category: ui
---

# User Idle Detection

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/idle/

## Best Practices

The `chrome.idle` API allows you to detect when a user has been idle for a specified amount of time. This is useful for various scenarios, such as:

*   **Saving resources:** When a user is idle, you can pause resource-intensive operations or display a screensaver.
*   **Security:** Log out users or present a security warning after a period of inactivity.
*   **User experience:** Provide prompts or suggestions when a user returns after being idle.

When using `chrome.idle.queryState`, you can specify the detection interval in seconds. The API returns one of three states: `'undetermined'`, `'idle'`, or `'active'`.

It's crucial to request the `idle` permission in your extension's manifest.

```json
{
  "name": "My Idle-Aware Extension",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": [
    "idle"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

In your background script (e.g., `background.js`), you can set up listeners for state changes:

```javascript
chrome.idle.queryState(60, function(state) {
  console.log('Current state is: ' + state);
});

// To detect changes, you can periodically query or set up listeners if available in future versions or alternative APIs.
// For now, periodic querying is the standard approach.
setInterval(() => {
  chrome.idle.queryState(30, function(state) {
    console.log('State check: ' + state);
    if (state === 'idle') {
      console.log('User is idle. Consider pausing background tasks.');
      // Example: Pause resource-intensive operations
      // chrome.storage.local.set({ 'isExtensionPaused': true });
    } else if (state === 'active') {
      console.log('User is active. Resume background tasks if paused.');
      // Example: Resume background tasks
      // chrome.storage.local.get(['isExtensionPaused'], function(result) {
      //   if (result.isExtensionPaused) {
      //     chrome.storage.local.set({ 'isExtensionPaused': false });
      //   }
      // });
    }
  });
}, 15000); // Check every 15 seconds
```

## Handling State Transitions

Be mindful of the `'undetermined'` state, which occurs when the API cannot yet determine the user's state. Your application should gracefully handle this initial state before a definitive `'idle'` or `'active'` state is reported.

When the user's state changes from `'active'` to `'idle'`, you might want to trigger specific actions. Conversely, when the state changes from `'idle'` back to `'active'`, you should revert any changes made during the idle period.

Consider the sensitivity of your application. For security-critical applications, a shorter idle timeout might be necessary. For less critical ones, a longer timeout can provide a better user experience by avoiding unnecessary interruptions.