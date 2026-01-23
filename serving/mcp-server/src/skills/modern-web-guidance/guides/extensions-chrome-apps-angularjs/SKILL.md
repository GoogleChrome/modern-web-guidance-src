---
description: Build and deploy Chrome Apps using AngularJS for creating interactive web applications that leverage Google APIs.
filename: chrome-apps-angularjs
category: extensions
---

# Building Chrome Apps with AngularJS

Reference docs:
- https://angularjs.org/
- https://developers.google.com/drive/get-started
- https://developer.chrome.com/docs/extensions/reference/app_identity

## Best Practices

When building Chrome Apps with AngularJS, consider the following best practices to ensure a robust and maintainable application.

### Manifest Configuration

Ensure your `manifest.json` includes necessary `oauth2` and `permissions` sections for API access and cross-domain requests.

```json
{
  "name": "Google Drive Uploader",
  "version": "0.0.1",
  "manifest_version": 2,
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID",
    "scopes": [
      "https://www.googleapis.com/auth/drive"
    ]
  },
  "permissions": [
    "https://docs.google.com/feeds/",
    "https://www.googleapis.com/"
  ]
}
```

### Event Page for Background Operations

Utilize an event page (e.g., `background.js`) to handle app launches and system events, defining window properties like size and frame.

```js
chrome.app.runtime.onLaunched.addListener(function(launchData) {
  chrome.app.window.create('../main.html', {
    id: "MyChromeApp",
    bounds: {
      width: 800,
      height: 600
    },
    minWidth: 800,
    minHeight: 600,
    frame: 'none' // Use 'none' for custom frames
  });
});
```

### AngularJS MVC Structure

Organize your application following the Model-View-Controller (MVC) pattern.

-   **View (`main.html`):** Use `ng-repeat` for rendering lists and `ng-controller` to bind templates to controllers. The `ng-app` directive bootstraps your AngularJS application.

    ```html
    <html data-ng-app="myApp">
    <body data-ng-controller="MyController">
      <section id="main">
        <nav>
          <h2>My App</h2>
          <button data-ng-click="refreshData()">Refresh</button>
        </nav>
        <ul>
          <li data-ng-repeat="item in items">
            <img data-ng-src="{{ item.icon }}">
            <a href="{{ item.link }}">{{ item.title }}</a>
            <span class="date">{{ item.updatedDate }}</span>
          </li>
        </ul>
      </section>
    </body>
    </html>
    ```

-   **Controller (`app.js`):** Define factories for services (like API interactions) and controllers to manage scope and data fetching.

    ```javascript
    var myApp = angular.module('myApp', []);

    myApp.factory('myService', function() {
      // Service implementation for API calls, auth, etc.
      return new MyService();
    });

    function MyController($scope, $http, myService) {
      $scope.items = [];

      $scope.refreshData = function() {
        // Fetch data logic
      };

      // Initial data fetch after authentication
      myService.auth(function() {
        $scope.refreshData();
      });
    }
    ```

### Content Security Policy (CSP)

AngularJS (v1.1.0+) works well with strict CSP. For older versions, use the `ngCsp` directive. Ensure external resource loading (like images) complies with CSP by importing them locally using XHR2 and `blob:` URLs.

### Authorization

Use the `chrome.identity.getAuthToken()` API to securely obtain OAuth tokens for accessing Google APIs. Wrap these calls in service methods for reusability.

### Offline Support and Caching

Implement caching for external resources (like file icons) using the HTML5 Filesystem API to improve performance and enable offline access. Use `window.URL.createObjectURL` for local file access. Explicitly call `$scope.$apply()` when model updates occur within asynchronous callbacks that Angular is not aware of.

### Drag and Drop Uploading

Leverage HTML5 Drag and Drop APIs with a library like `DnDFileController` to allow users to upload files directly from their desktop to cloud services.

```javascript
// Example within a service or controller
var dnd = new DnDFileController('body', function(files) {
  var $scope = angular.element(this).scope();
  Util.toArray(files).forEach(function(file) {
    myService.upload(file, function() {
      $scope.refreshData(); // Refresh data after upload
    });
  });
});
```

## Fallback Strategies

While the above practices aim for a seamless experience, consider fallback strategies for features that might not be universally supported. However, for the core functionalities like AngularJS, Chrome APIs, and standard HTML5 features used in building Chrome Apps, direct implementation is generally reliable. Focus on thorough testing across target environments.