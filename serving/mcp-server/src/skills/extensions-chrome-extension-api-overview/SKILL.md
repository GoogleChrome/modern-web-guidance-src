---
description: Learn about the Chrome Extension APIs that enable extensions to interact with the Chrome browser and provide custom functionality.
filename: chrome-extension-api-overview
category: extensions
---

# Chrome Extension APIs

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/
- https://developer.chrome.com/docs/extensions/mv3/

## Common Extensions API Features

Chrome Extension APIs are organized into namespaces, each offering specific functionalities. These namespaces typically contain methods and properties that extensions can use to perform actions. For instance, the `chrome.action` namespace requires a corresponding `"action"` object in the `manifest.json` file.

Many APIs also necessitate specific permissions to be declared in the `manifest.json` file. You can find more information on declaring permissions at [https://developer.chrome.com/docs/extensions/mv3/declare_permissions/](https://developer.chrome.com/docs/extensions/mv3/declare_permissions/).

### Asynchronous Methods

Methods within extension APIs are generally asynchronous, meaning they return immediately without waiting for the operation to complete. To handle the results of these asynchronous methods, developers should utilize promises.

<aside class="key-point">Manifest V3 support is generally available in Chrome 88 and later. For features introduced in later Chrome versions, consult the specific API documentation. If your extension relies on a particular API, you can specify a minimum Chrome version in your manifest file.</aside>

## API Availability and Aliasing

Starting with Chrome 144, all Chrome Extension APIs are accessible through the `browser` namespace (e.g., `browser.tabs.create({})`). This serves as an alias for the `chrome` namespace (e.g., `chrome.tabs.create({})`) to ensure compatibility with other browsers that use the `browser` namespace for their extension APIs.

## Manifest V3

Manifest V3 is the latest version of the extension platform and is designed to improve security, performance, and user privacy. You can find more details about Manifest V3 in the documentation:

- [https://developer.chrome.com/docs/extensions/mv3/overview/](https://developer.chrome.com/docs/extensions/mv3/overview/)

## Chrome Extension API Categories

The Chrome Extension APIs cover a wide range of functionalities, including:

*   **Action**: Controls the extension's icon in the toolbar.
*   **Alarms**: Schedule code to run at specific times.
*   **Browsing Data**: Manage browsing data like cookies and cache.
*   **Commands**: Define keyboard shortcuts for extension actions.
*   **Content Scripts**: Inject JavaScript and CSS into web pages.
*   **Declarative Net Request**: Block or modify network requests.
*   **Downloads**: Manage file downloads.
*   **Extension**: Information about the extension itself.
*   **History**: Access and modify the browser's history.
*   **I18n**: Internationalization and localization.
*   **Identity**: Get user information and OAuth tokens.
*   **Page Actions**: Display an icon in the address bar for specific pages.
*   **Permissions**: Request and manage permissions.
*   **Storage**: Store data locally.
*   **Tabs**: Interact with browser tabs.
*   **Top Sites**: Access a list of the user's most visited sites.
*   **Web Navigation**: Track and analyze navigation events.
*   **Windows**: Interact with browser windows.

This is not an exhaustive list, and the Chrome Extension API documentation provides a comprehensive overview of all available namespaces and their methods.