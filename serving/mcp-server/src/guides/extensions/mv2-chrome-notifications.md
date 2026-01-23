---
description: Implement rich desktop notifications in Chrome extensions using the webkitNotifications API for Manifest V2.
filename: mv2-chrome-notifications
category: extensions
---

# Rich Notifications in Manifest V2 Chrome Extensions

Reference docs:
- [Desktop Notifications Draft Specification][5]

## Best Practices

Use the `webkitNotifications` API to create and display rich desktop notifications for your Manifest V2 Chrome extension. These notifications appear outside the browser window, providing timely information to users.

### Manifest Declaration

First, declare the `notifications` permission in your `manifest.json` file:

```json
{
  "name": "My extension",
  "manifest_version": 2,
  ...
  "permissions": [
    "notifications"
  ],
  ...
  // Note: Due to a known bug, images used with createNotification() must be declared as web accessible resources.
  "web_accessible_resources": [
    "48.png"
  ]
}
```

### Creating Notifications

You can create simple text notifications or more complex HTML notifications.

**Simple Text Notification:**

```js
var notification = webkitNotifications.createNotification(
  '48.png',  // icon url - can be relative
  'Hello!',  // notification title
  'Lorem ipsum...'  // notification body text
);
```

**HTML Notification:**

```js
var notification = webkitNotifications.createHTMLNotification(
  'notification.html'  // html url - can be relative
);
```

### Displaying Notifications

After creating the notification object, call the `show()` method:

```js
notification.show();
```

**Important:** Extensions declaring the `notifications` permission are automatically allowed to create notifications, so calling `webkitNotifications.checkPermission()` is unnecessary.

## Communicating with Other Views

You can facilitate communication between notifications and other parts of your extension using `extension.getBackgroundPage` and `extension.getViews`.

**Calling a function in the background page:**

```js
chrome.extension.getBackgroundPage().doThing();
```

**Accessing notification views:**

```js
chrome.extension.getViews({type:"notification"}).forEach(function(win) {
  win.doOtherThing();
});
```

## Deprecation and Migration

**Warning:** The `webKitNotifications.createHTMLNotification()` method from the web notifications API is deprecated. The newer web notifications API primarily supports text, and richer notifications are now handled by the Chrome Notifications API. For new development, consider migrating to Manifest V3. The Chrome Web Store no longer accepts Manifest V2 extensions. Refer to the [Manifest V3 Migration guide](/docs/extensions/develop/migrate) for assistance.

## More Examples

Explore the [examples/api/notifications][8] directory for a simple notification implementation. For additional examples and guidance on viewing source code, see [Samples][9]. The [html5rocks.com notifications tutorial][10] also provides useful information, though you can disregard its permission-related code as it's redundant when the `notifications` permission is declared.

[5]: http://dev.chromium.org/developers/design-documents/desktop-notifications/api-specification
[8]: https://github.com/GoogleChrome/chrome-extensions-samples/tree/master/_archive/mv2/api/notifications/
[9]: /docs/extensions/mv2/samples
[10]: http://www.html5rocks.com/tutorials/notifications/quick/