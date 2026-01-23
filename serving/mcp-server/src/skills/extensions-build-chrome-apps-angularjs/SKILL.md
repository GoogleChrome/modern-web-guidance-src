---
description: Building Chrome Apps with AngularJS, covering manifest creation, event pages, Angular MVC structure, data fetching, and offline caching.
filename: build-chrome-apps-angularjs
category: extensions
---

# Building Chrome Apps with AngularJS

This guide provides a comprehensive overview of building Chrome Apps using the AngularJS framework. It covers essential aspects from initial setup and manifest configuration to implementing the Model-View-Controller (MVC) pattern with AngularJS, handling data fetching, and optimizing performance through offline caching.

## Key Concepts and Best Practices

### Manifest Configuration (`manifest.json`)

*   **Essential Information:** The `manifest.json` file is crucial for Chrome Apps, providing metadata and defining necessary permissions.
*   **OAuth2 Integration:** Properly configure the `oauth2` section, including `client_id` and `scopes`, to handle authentication with Google APIs. Refer to [Get your client id][15] for instructions.
*   **Permissions:** Explicitly list URLs that the app will access via XHR2 in the `permissions` section to allow cross-domain requests.

### Event Page (`background.js`)

*   **App Launch and Event Handling:** A background script is required to launch the app and respond to system events.
*   **Window Management:** Use `chrome.app.window.create()` to define the app's window size, minimum dimensions, and frame style.
*   **Chromeless Windows:** Utilize `frame: 'none'` for custom window appearances, allowing for custom navigation bars and control buttons as demonstrated in the Google Drive Uploader example.

### AngularJS MVC Implementation

*   **View (`main.html`):** Define HTML templates using directives like `data-ng-repeat` for iterating over data and `data-ng-src` for dynamic image sources.
*   **Controller (`DocsController`):** Use `data-ng-controller` to associate a controller with a specific part of the view.
*   **App Initialization (`ngApp`):** Apply the `data-ng-app` directive to the root element (e.g., `<html>`) to initialize the Angular application.
*   **Content Security Policy (CSP):** AngularJS (v1.1.0+) works seamlessly with strict CSP. For older versions (v1.0.1 to v1.1.0), use the `data-ng-csp` directive.

### Handling Authorization (`chrome.identity`)

*   **OAuth Token Fetching:** Use `chrome.identity.getAuthToken()` to obtain an OAuth token for user authentication with Google APIs.
*   **Token Reusability:** Store the fetched `accessToken` for subsequent API calls.
*   **Flexibility with Callbacks:** Employ optional callbacks to ensure actions are performed only after the OAuth token is ready.

### Data Fetching (`$http`)

*   **API Requests:** Leverage AngularJS's `$http` service to make requests to external APIs.
*   **Authorization Headers:** Include the OAuth token in the `Authorization` header for authenticated API calls.
*   **Response Handling:** Process API responses to populate the application's data model.

### Offline Caching and Performance

*   **Importing Remote Assets:** To comply with CSP, import remote images as Blobs using XHR2 and create `blob: URLs` for their `src` attributes.
*   **HTML5 Filesystem API:** Implement caching of external resources (like file icons) using the HTML5 Filesystem API to avoid repeated XHR requests.
*   **`window.webkitResolveLocalFileSystemURL()`:** Use this function to check for cached files. If a file exists, use its filesystem URL; otherwise, fetch and write it to the filesystem.
*   **`$scope.$apply()`:** Explicitly call `$scope.$apply()` when making asynchronous updates to the data model from outside Angular's digest cycle to ensure the UI reflects changes.

### Drag and Drop Uploading

*   **HTML5 Drag and Drop APIs:** Integrate drag-and-drop functionality for uploading files directly from the desktop.
*   **Custom Controllers:** Implement libraries like `DnDFileController` to manage the drag-and-drop events and file uploads.
*   **Callback for Updates:** After a successful upload, trigger a refresh of the displayed documents (e.g., by calling `fetchDocs()`).

## Resources

*   **AngularJS:** [https://angularjs.org/][3]
*   **Chrome App Samples (Google Drive Uploader):** [https://github.com/GoogleChrome/chrome-app-samples/tree/master/samples/gdrive][4]
*   **HTML Drag and Drop Basics:** [https://www.html5rocks.com/en/tutorials/dnd/basics/][5], [https://www.html5rocks.com/en/tutorials/dnd/basics/][13]
*   **HTML5 Filesystem API:** [http://www.html5rocks.com/en/tutorials/file/filesystem/][12]
*   **Chrome Identity API:** [https://developer.chrome.com/docs/extensions/reference/app_identity/][14]
*   **Google Drive API:** [https://developers.google.com/drive/get-started][9], [https://developers.google.com/drive/get-started][11]
*   **Content Security Policy:** [https://developer.chrome.com/docs/extensions/reference/contentSecurityPolicy][10], [https://developer.chrome.com/docs/extensions/reference/contentSecurityPolicy][23]

[15]: /docs/extensions/reference/app_identity#client_id
[3]: https://angularjs.org/
[4]: https://github.com/GoogleChrome/chrome-app-samples/tree/master/samples/gdrive
[5]: https://www.html5rocks.com/en/tutorials/dnd/basics/
[13]: http://www.html5rocks.com/en/tutorials/dnd/basics/
[12]: http://www.html5rocks.com/en/tutorials/file/filesystem/
[14]: /docs/extensions/reference/app_identity
[9]: https://developers.google.com/drive/get-started
[11]: https://developers.google.com/drive/get-started
[10]: /docs/extensions/reference/contentSecurityPolicy
[23]: /docs/extensions/reference/contentSecurityPolicy