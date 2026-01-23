---
description: Implement a context menu that appears on alternate mouse clicks to invoke extension features.
filename: context-menus
category: extensions
---

# Context Menus

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/contextMenus
- https://developer.chrome.com/docs/extensions/reference/manifest/permissions#contextMenus
- https://developer.chrome.com/docs/extensions/reference/runtime#event-onInstalled

## Best Practices

To build a context menu, first add the `"contextMenus"` permission to your `manifest.json` file.

```json
  "permissions": [
    "contextMenus"
  ],
```

Optionally, use the `"icons"` key in your `manifest.json` to display an icon next to a context menu item.

You can create context menu items by calling `chrome.contextMenus.create()` in your extension's service worker. When an extension has multiple context menu items, Chrome will automatically group them under a single parent menu.

```javascript
const tldLocales = {
  'com.au': 'Australia',
  'com.br': 'Brazil',
  // ... more locales
};

chrome.runtime.onInstalled.addListener(async () => {
  for (const [tld, locale] of Object.entries(tldLocales)) {
    chrome.contextMenus.create({
      id: tld,
      title: locale,
      type: 'normal',
      contexts: ['selection'], // Specify contexts where the menu item should appear
    });
  }
});
```

When implementing multiple context menus, consider nesting them to organize your options logically. This can be achieved by creating sub-menu items that are visually grouped under a parent menu item. The sample provided in the documentation showcases how to import sub-menu items from a `locales.js` file and iterate over them using `runtime.onInstalled`.