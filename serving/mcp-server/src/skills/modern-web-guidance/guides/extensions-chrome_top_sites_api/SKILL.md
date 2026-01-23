---
description: Retrieve and manage a user's most visited websites to enhance browser functionality and provide personalized experiences.
filename: chrome_top_sites_api
category: extensions
---

# chrome.topSites API

The `chrome.topSites` API allows extensions to access and interact with the user's most visited websites, enabling features like personalized suggestions or custom start pages.

## Permissions

To use the `chrome.topSites` API, you must declare the `"topSites"` permission in your extension's manifest file.

```json
{
  "name": "My Top Sites Extension",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": [
    "topSites"
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
```

## Best Practices

When working with the `chrome.topSites` API, consider the following best practices:

### User Privacy and Consent

- **Always inform the user** about why your extension needs access to their top sites.
- **Request the `topSites` permission only when necessary.** If your feature relies on this data, explain the benefit clearly in your extension's description and during the permission request.
- **Avoid storing or transmitting top sites data** unless it's essential for your extension's core functionality and you have explicit user consent.

### Data Handling

- **Handle potential errors gracefully.** The `chrome.topSites.get()` function can return an empty array or throw an error if the user has no history or if there are other issues. Implement error handling to prevent your extension from crashing.
- **Consider the data format.** The `get()` method returns an array of `TopSite` objects, each containing a `url` and `title`. Process this data efficiently.

### Performance

- **Call `chrome.topSites.get()` sparingly.** Frequent calls can impact browser performance, especially if the underlying data needs to be refreshed. Fetch the data when it's actually needed for display or processing.

## Examples

### Retrieving Top Sites

This example demonstrates how to retrieve the user's top sites and log them to the console.

```javascript
chrome.topSites.get(function(sites) {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError.message);
    return;
  }
  if (sites.length > 0) {
    console.log("User's Top Sites:");
    sites.forEach(site => {
      console.log(`- Title: ${site.title}, URL: ${site.url}`);
    });
  } else {
    console.log("No top sites data found.");
  }
});
```

### Using Top Sites in a Popup

You can use the retrieved top sites data to populate a popup or a custom new tab page.

**popup.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Top Sites</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <h1>Your Top Sites</h1>
  <ul id="top-sites-list"></ul>
  <script src="popup.js"></script>
</body>
</html>
```

**popup.js:**
```javascript
chrome.topSites.get(function(sites) {
  const listElement = document.getElementById('top-sites-list');
  if (chrome.runtime.lastError) {
    const errorItem = document.createElement('li');
    errorItem.textContent = `Error: ${chrome.runtime.lastError.message}`;
    listElement.appendChild(errorItem);
    return;
  }
  if (sites.length > 0) {
    sites.forEach(site => {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = site.url;
      link.textContent = site.title || site.url; // Use title if available, otherwise URL
      link.target = "_blank"; // Open in new tab
      listItem.appendChild(link);
      listElement.appendChild(listItem);
    });
  } else {
    const noSitesItem = document.createElement('li');
    noSitesItem.textContent = "You haven't visited many sites yet!";
    listElement.appendChild(noSitesItem);
  }
});
```

## Further Resources

- **Top Sites API Example:** [chrome-extensions-samples/api-samples/topSites](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/topSites)
- **Chrome Extension Manifest Documentation:** [developer.chrome.com/docs/extensions/reference/manifest](https://developer.chrome.com/docs/extensions/reference/manifest)