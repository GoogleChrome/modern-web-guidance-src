---
description: Manages the lifecycle of Chrome Apps, from installation and launch to suspension and termination, ensuring proper event handling and data persistence.
filename: chrome-app-lifecycle-management
category: extensions
---

# Chrome App Lifecycle Management

This document outlines the core concepts and best practices for managing the lifecycle of Chrome Apps, focusing on the interaction between the app runtime and the event page.

## Core Components

*   **App Runtime:** Responsible for the overall management of the app, including installation, updates, uninstallation, and controlling the event page.
*   **Event Page:** The central hub for an app's logic. It handles app launches, listens for runtime events, and manages the creation and interaction with app windows.

## Key Lifecycle Events and Practices

### Launching and Window Creation

When a Chrome App is launched, the `chrome.app.runtime.onLaunched()` event is fired in the event page. This event is crucial for initiating the app's functionality and creating its user interface.

*   **DO** implement the `onLaunched()` function in your event page to define what happens upon app launch.
*   **DO** use `chrome.app.window.create()` to define and display app windows.
*   **DO** provide a unique `id` for windows to enable restoration of their size and location after a restart.
*   **DO** specify `bounds` to control the initial dimensions and position of your app windows.
*   **DO** set `minWidth` and `minHeight` to ensure a minimum usable size for your windows.

```js
chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('main.html', {
    id: 'MyWindowID',
    bounds: {
      width: 800,
      height: 600,
      left: 100,
      top: 100
    },
    minWidth: 800,
    minHeight: 600
  });
});
```

### Handling Launch Data

Some app launches may include data, particularly when apps are configured with file handlers.

*   **DO** handle the `launchData.items` parameter in your `onLaunched` function if your app needs to process files passed during launch.

### Responding to Runtime Events

The app runtime provides several events that your event page can listen to for managing the app's state.

*   **`chrome.runtime.onInstalled()`**:
    *   **DO** listen for this event to perform initial setup tasks, such as storing default settings using the Storage API.
    *   This event fires not only on initial installation but also on app updates.

    ```js
    chrome.runtime.onInstalled.addListener(function() {
      chrome.storage.local.set({ key: 'value' }, function() {
        console.log('Settings initialized.');
      });
    });
    ```

*   **`chrome.runtime.onSuspend()`**:
    *   **DO** implement a listener for this event to perform necessary clean-up tasks before the event page is unloaded.
    *   This is the last opportunity to save critical application state to persistent storage.
    *   **DO** consider incrementally saving app state during normal operation to minimize data loss if the app is terminated unexpectedly.
    *   **DO** save state to persistent storage so that the app can be restarted in the same state if an `onRestarted` event is received.

    ```js
    chrome.runtime.onSuspend.addListener(function() {
      // Save application state to persistent storage.
      console.log('App suspending. Saving state...');
    });
    ```

*   **`chrome.runtime.onSuspendCanceled()`**:
    *   **DO** be aware that this event indicates the suspension process was aborted, and the app will not be unloaded.

### Preventing Data Loss

User data can be lost if an app is uninstalled.

*   **DO** use the Storage API (`chrome.storage.local` or `chrome.storage.sync`) to store user settings and critical data.
*   **DO** leverage `chrome.storage.sync` for data that should be synchronized across user's Chrome instances. This helps users retain their information if they reinstall the app.

### Event Page Structure

*   **DO** include the `"background"` field in your app's manifest file.
*   **DO** list any library scripts required by the event page within the `"scripts"` array under `"background"`, ensuring `background.js` is listed last if it depends on other scripts.

```json
"background": {
  "scripts": [
    "foo.js",
    "background.js"
  ]
}
```

*   **DO** ensure your `background.js` file contains the `chrome.app.runtime.onLaunched` listener.
*   **DO NOT** include any UI elements within the event page itself. Its primary role is logic and window management.