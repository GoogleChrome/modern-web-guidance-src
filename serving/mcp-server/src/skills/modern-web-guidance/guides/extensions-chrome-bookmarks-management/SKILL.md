---
description: Manage browser bookmarks programmatically using the chrome.bookmarks API.
filename: chrome-bookmarks-management
category: extensions
---

# Chrome Bookmarks Management

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/bookmarks

## Best Practices

The `chrome.bookmarks` API allows extensions to create, read, update, and delete bookmarks. Bookmarks are organized hierarchically in a tree structure, with nodes representing either individual bookmarks or folders.

### Creating Bookmarks and Folders

To create a new bookmark or folder, use the `chrome.bookmarks.create()` method. This method takes an object with properties defining the new item and an optional callback function to execute upon completion.

*   **Specify the parent:** The `parentId` property is crucial for indicating where the new item should be placed within the bookmark tree. You can use the ID of an existing folder or a special ID like `chrome.bookmarks.BookmarkTreeNode.id` for the root.
*   **Define title and URL:** For bookmarks, provide a `title` and a `url`. For folders, only a `title` is necessary.

```javascript
// Create a new folder named "Extension Bookmarks" under the bookmark bar
chrome.bookmarks.create(
  {'parentId': bookmarkBar.id, 'title': 'Extension Bookmarks'},
  function(newFolder) {
    console.log("Created folder: " + newFolder.title);
  }
);

// Create a new bookmark pointing to the Chrome Extensions documentation
chrome.bookmarks.create({
  'parentId': extensionsFolderId, // Assuming extensionsFolderId is already defined
  'title': 'Chrome Extensions Docs',
  'url': 'https://developer.chrome.com/docs/extensions',
});
```

### Accessing and Modifying Bookmarks

*   **Querying bookmarks:** Use `chrome.bookmarks.search()` to find bookmarks based on various criteria like title, URL, or folder.
*   **Updating bookmarks:** The `chrome.bookmarks.update()` method allows you to change properties like title, URL, or parent of an existing bookmark or folder.
*   **Removing bookmarks:** Use `chrome.bookmarks.remove()` to delete a specific bookmark or folder.

### Important Considerations

*   **Permission Warnings:** The `bookmarks` permission triggers a warning to the user during extension installation. Ensure users understand why your extension needs this permission.
*   **Root Folder Limitations:** You cannot directly add, remove, rename, or move entries in the root folder. Similarly, the "Bookmarks Bar" and "Other Bookmarks" special folders have limitations on modification.
*   **Error Handling:** Always consider providing callback functions to API methods to handle potential errors gracefully.

To explore practical implementations, refer to the [Bookmarks API example][6] in the `chrome-extension-samples` repository.

[1]: /docs/extensions/mv3/manifest
[2]: #type-BookmarkTreeNode
[3]: #method-create
[4]: #type-BookmarkTreeNode
[5]: https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples
[6]: https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/bookmarks