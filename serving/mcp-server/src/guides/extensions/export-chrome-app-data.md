---
description: Enable users to export data from a Chrome App to a local file using the Filesystem API.
filename: export-chrome-app-data
category: extensions
---

# Exporting Chrome App Data to Filesystem

Reference docs:
- [Using the Chrome Filesystem API](/docs/apps/app_storage#filesystem)
- [Declare Permissions](/apps/declare_permissions)
- [chrome.storage.local.get()](/apps/storage#method-StorageArea-get)
- [chrome.fileSystem.chooseEntry()](/docs/apps/reference/fileSystem#method-chooseEntry)
- [chrome.fileSystem.getDisplayPath()](/docs/apps/reference/fileSystem#method-getDisplayPath)
- [chrome.fileSystem.restoreEntry()](/docs/apps/reference/fileSystem#method-restoreEntry)
- [chrome.fileSystem.retainEntry()](/docs/apps/reference/fileSystem#method-retainEntry)

## Best Practices

To allow users to export data from your Chrome App to their local filesystem, you should:

1.  **Declare necessary permissions**: Request `"fileSystem"` with `"write"` access in your `manifest.json` file.
    ```json
    "permissions": [
      "storage",
      "alarms",
      "notifications",
      "webview",
      "<all_urls>",
      { "fileSystem": ["write"] }
    ],
    ```
2.  **Provide a user interface element**: Add a button or link in your HTML to trigger the export action.
    ```html
    <button id="exportToDisk">Export to disk</button>
    <div id="status"></div>
    ```
3.  **Implement the export logic**:
    *   Use `chrome.fileSystem.chooseEntry()` to allow the user to select a file for saving. Specify `type: 'saveFile'`, `suggestedName`, and `accepts` to guide the user.
    *   If a `FileEntry` has been previously saved and retained, you can use it directly to avoid prompting the user every time.
    *   Retrieve the data to be exported (e.g., from `chrome.storage.local`).
    *   Use `chrome.fileSystem.getDisplayPath()` to get a user-friendly path for display.
    *   Create a `Blob` from the exported data.
    *   Use `fileEntry.createWriter()` to get a `FileWriter`.
    *   Handle `onwriteend` and `onerror` events for the `FileWriter` to provide user feedback.
    *   Use `fileWriter.write(blob)` to write the data.
    *   Crucially, when writing, you must first `truncate` the file to its new size if it already exists to prevent appending data and corrupting the file.

    ```js
    function doExportToDisk() {
      if (savedFileEntry) {
        exportToFileEntry(savedFileEntry);
      } else {
        chrome.fileSystem.chooseEntry({
          type: 'saveFile',
          suggestedName: 'todos.txt',
          accepts: [{ description: 'Text files (*.txt)', extensions: ['txt'] }],
          acceptsAllTypes: true
        }, exportToFileEntry);
      }
    }

    function exportToFileEntry(fileEntry) {
      savedFileEntry = fileEntry;
      var status = document.getElementById('status');

      chrome.fileSystem.getDisplayPath(fileEntry, function(path) {
        fileDisplayPath = path;
        status.innerText = 'Exporting to '+path;
      });

      getTodosAsText(function(contents) { // Assume getTodosAsText() is implemented
        fileEntry.createWriter(function(fileWriter) {
          var truncated = false;
          var blob = new Blob([contents]);

          fileWriter.onwriteend = function(e) {
            if (!truncated) {
              truncated = true;
              this.truncate(blob.size); // Truncate to the new blob size
              return;
            }
            status.innerText = 'Export to '+fileDisplayPath+' completed';
          };

          fileWriter.onerror = function(e) {
            status.innerText = 'Export failed: '+e.toString();
          };

          fileWriter.write(blob);
        });
      });
    }
    ```

4.  **Consider `FileEntry` persistence**: `FileEntry` objects have a limited lifespan. For persistence across app restarts, you might need to use `chrome.fileSystem.retainEntry()` and `chrome.fileSystem.restoreEntry()`. This is an advanced topic and may require handling the `onRestarted` event in your background script.