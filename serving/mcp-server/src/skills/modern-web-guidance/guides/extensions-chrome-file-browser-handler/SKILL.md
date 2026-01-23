---
description: Implement custom file handling logic in Chrome extensions by responding to user interactions within the ChromeOS file browser.
filename: chrome-file-browser-handler
category: extensions
---

# Implementing a Chrome File Browser Handler

This document outlines how to implement custom file handling logic within Chrome extensions using the `chrome.fileBrowserHandler` API. This API allows extensions to integrate with the ChromeOS file browser, enabling custom actions when users select files.

## Use Case

The primary use case for `chrome.fileBrowserHandler` is to provide custom functionality for users interacting with files through the ChromeOS file browser. This could include:

*   Saving files to specific cloud storage or application-specific locations.
*   Processing or transforming selected files (e.g., image editing, document conversion).
*   Uploading files to a web service directly from the file browser.
*   Performing custom organization or tagging of files.

## Manifest Declaration

To use the `chrome.fileBrowserHandler` API, you must declare the `"fileBrowserHandler"` permission in your extension's manifest file. Additionally, you need to register your extension as a handler for specific file types using the `"file_browser_handlers"` field. This field requires an `"id"` for the handler, a `"default_title"` that will appear as a button in the file browser, and a list of `"file_filters"` that define which file types your handler supports. You should also provide a 16x16 icon for the handler button.

Here's an example of the relevant sections in `manifest.json`:

```json
{
  "name": "My File Handler Extension",
  "version": "1.0",
  "manifest_version": 2,
  "permissions": [
    "fileBrowserHandler"
  ],
  "file_browser_handlers": [
    {
      "id": "my_custom_handler",
      "default_title": "Process File",
      "file_filters": [
        "filesystem:*.txt",
        "filesystem:*.md"
      ]
    }
  ],
  "icons": {
    "16": "icons/icon16.png"
  }
}
```

**Note:** For locale-specific button titles, refer to the [Internationalization (i18n)](/docs/extensions/mv2/reference/i18n) documentation.

## Implementing the Event Listener

You need to implement a listener for the `chrome.fileBrowserHandler.onExecute` event. This listener will be triggered when the user clicks the button associated with your file browser handler.

The event listener receives two arguments:

1.  `id`: The `"id"` string declared in the manifest. This is useful if your extension defines multiple file browser handlers.
2.  `details`: An object containing information about the execution event. The `details.entries` field is an array of `FileSystemFileEntry` objects representing the files selected by the user.

Inside your listener, you can use the [File System API](https://developer.mozilla.org/docs/Web/API/FileSystemFileEntry) to access and process the selected files.

Here's an example implementation:

```js
chrome.fileBrowserHandler.onExecute.addListener(async (id, details) => {
  // Check if this is the handler you're interested in (if you have multiple)
  if (id === 'my_custom_handler') {
    for (const entry of details.entries) {
      // FileSystemFileEntry does not have a Promise API, so wrap in a Promise
      const file = await new Promise((resolve, reject) => {
        entry.file(resolve, reject);
      });

      // Read the file content as an ArrayBuffer
      const buffer = await file.arrayBuffer();

      // Now you can process the file content (e.g., display it, upload it, etc.)
      console.log(`Processing file: ${file.name}`);
      // Example: Displaying a portion of the buffer as text
      const textDecoder = new TextDecoder('utf-8');
      console.log('File content snippet:', textDecoder.decode(buffer.slice(0, 100)));

      // TODO: Implement your custom file processing logic here
    }
  }
});
```

## Best Practices

*   **Clear File Filters:** Define precise `file_filters` in your manifest to ensure your handler is only presented for relevant file types. This improves user experience by avoiding unnecessary clutter.
*   **Descriptive Button Titles:** Use clear and concise `default_title` values that accurately describe the action your handler performs.
*   **Error Handling:** Implement robust error handling within your `onExecute` listener to gracefully manage issues like file access errors or processing failures.
*   **User Feedback:** Provide visual feedback to the user during file processing, especially for long-running operations. This could involve displaying a progress indicator or a notification.
*   **Resource Management:** Ensure you properly handle file resources and avoid memory leaks, particularly when dealing with large files.
*   **Check Handler ID:** If your extension supports multiple file browser handlers, always check the incoming `id` in the `onExecute` listener to ensure you are executing the correct logic.
*   **Leverage File System API:** Familiarize yourself with the `FileSystemFileEntry` and related APIs to efficiently read and manipulate file data. Use `file.arrayBuffer()` for binary data or `file.text()` for text-based files.