---
description: Enable extensions to capture and save the current state of a web page as a single MHTML file for offline access or further processing.
filename: page-capture
category: extensions
---

# Capturing Web Pages

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/pageCapture
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types

## Best Practices

The `chrome.pageCapture` API allows extensions to save the current state of a web page, including its resources, into a single MHTML (MIME HTML) file. This is useful for creating offline versions of pages, for content analysis, or for archiving.

### Permissions

To use the `pageCapture` API, you must declare the `"pageCapture"` permission in your extension's manifest file.

```json
{
  "name": "My Page Capture Extension",
  "version": "1.0",
  "manifest_version": 2,
  "permissions": [
    "pageCapture"
  ],
  "background": {
    "scripts": ["background.js"]
  }
}
```

**Note:** The "pageCapture" permission triggers a warning to the user during installation, indicating that the extension can capture the content of web pages.

### Capturing a Page

The primary function is `chrome.pageCapture.saveAsMHTML()`. This method takes an object with a `tabId` property and a callback function.

```javascript
// background.js

chrome.action.onClicked.addListener((tab) => {
  chrome.pageCapture.saveAsMHTML({ tabId: tab.id }, (mhtmlData) => {
    if (chrome.runtime.lastError) {
      console.error("Error saving MHTML:", chrome.runtime.lastError);
      return;
    }
    // mhtmlData is a Blob containing the MHTML content
    // You can then save this Blob, send it elsewhere, etc.
    const url = URL.createObjectURL(mhtmlData);
    // Example: open in a new tab
    window.open(url);
    // Or save it
    // chrome.downloads.download({
    //   url: url,
    //   filename: "page.mhtml"
    // });
  });
});
```

### MHTML Format

MHTML is a standard format that encapsulates a web page and all its resources (CSS, images, etc.) into a single file.

### Security Considerations

- MHTML files can only be loaded from the file system.
- They can only be loaded in the main frame of a tab.

## Limitations

- The `saveAsMHTML` function can only be called from a script that has been granted access to the tab's content, typically a background script or a content script injected into the tab.
- If the page has extensive dynamic content or relies heavily on client-side JavaScript to render, the captured MHTML might not perfectly represent the page's state at the exact moment of capture.